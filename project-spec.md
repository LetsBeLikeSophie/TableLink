# 테이블 조인 & 세그먼트 필터 도구 (Spring Boot 포트폴리오 프로젝트)

## 프로젝트 개요
테이블의 성격(상태성 STATE vs 히스토리성 HISTORY)에 따라 조인 방식이 정형화된다는 아이디어를 기반으로,
사용자가 테이블을 등록하고 드래그앤드롭으로 조인 관계를 만든 뒤, 필터 조건으로 고객 세그먼트를 뽑아내는 웹 도구.

도메인: 고객 차량 데이터 (가상 스키마)

---

## 1. 데이터베이스 스키마

### 상태 테이블 (STATE) — 키당 유니크, 현재값만 유지

```sql
CREATE TABLE customer (
    customer_id BIGINT PRIMARY KEY,
    name VARCHAR(50),
    phone VARCHAR(20),
    joined_at DATE
);

CREATE TABLE dealer (
    dealer_id BIGINT PRIMARY KEY,
    name VARCHAR(50),
    region VARCHAR(50)
);

CREATE TABLE vehicle (
    vehicle_id BIGINT PRIMARY KEY,
    vin VARCHAR(30) UNIQUE,
    model VARCHAR(50),
    model_year INT,
    current_owner_id BIGINT REFERENCES customer(customer_id)
);
```

### 히스토리 테이블 (HISTORY)

**구간형 (Range-type)** — start_date ~ end_date로 "기간"을 표현. end_date가 NULL이면 현재까지 유효.

```sql
CREATE TABLE ownership_history (
    id BIGINT PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicle(vehicle_id),
    owner_id BIGINT REFERENCES customer(customer_id),
    start_date DATE,
    end_date DATE  -- NULL이면 현재 소유 중
);
```

**시점형 (Point-type)** — 날짜 컬럼 하나로 "한 시점"의 기록. 계속 로그처럼 쌓임.

```sql
CREATE TABLE service_history (
    id BIGINT PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicle(vehicle_id),
    dealer_id BIGINT REFERENCES dealer(dealer_id),
    service_date DATE,
    description VARCHAR(200)
);

CREATE TABLE warranty_claim_history (
    id BIGINT PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicle(vehicle_id),
    claim_date DATE,
    claim_type VARCHAR(50),  -- 카테고리성 컬럼 (예: 엔진/배터리/내장재)
    amount DECIMAL(10,2)
);

CREATE TABLE price_history (
    id BIGINT PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicle(vehicle_id),
    recorded_at DATE,
    price DECIMAL(12,2)
);
```

> 참고: 다대다 관계는 범위에서 제외. 현재 스키마는 전부 1:N 관계로만 구성.

---

## 2. 테이블 메타데이터 모델

```
TableMeta {
  tableName: string
  type: STATE | HISTORY
  historySubType: POINT | RANGE   (HISTORY일 때만 사용)
  primaryKey: string
  dateColumn: string              (POINT: 단일 날짜 컬럼 / RANGE: 시작일 컬럼)
  endDateColumn: string           (RANGE일 때만, nullable 허용)
  foreignKeys: [{ column, refTable, refColumn }]
  filterableColumns: [
    { column: string, valueType: CATEGORY | FREE_TEXT | NUMBER | DATE }
  ]
}
```

- `filterableColumns`: 필터 화면에 노출 가능한 컬럼 화이트리스트. 이 목록에 없는 컬럼명은
  필터 요청 시 서버가 거부함 (SQL 인젝션 방지 — 컬럼명은 PreparedStatement 파라미터 바인딩이
  불가능한 자리라 화이트리스트 검증으로 방어).

### 자동 판정 컨벤션 (수동 등록 대신)

`type` / `historySubType` / `foreignKeys`는 사용자가 직접 입력하지 않고, DB 스키마 조회 +
네이밍 컨벤션으로 자동 판정한다:

- 테이블명이 `_history`로 끝나면 → `HISTORY`, 아니면 → `STATE`
- `HISTORY`인 테이블에 `end_date`류(nullable) 컬럼이 있으면 → `RANGE`, 없으면 → `POINT`
- `foreignKeys`는 `information_schema`(또는 JPA 메타모델)에서 FK 제약조건을 그대로 조회

`filterableColumns`만 자동화하지 않는다 — 필터로 노출해도 되는 컬럼을 고르는 의도적
화이트리스트이자 SQL 인젝션 방어 장치라서, 전체 컬럼을 무조건 다 넣으면 화이트리스트의
의미가 없어짐. 기본값은 "PK/FK 제외 전체 컬럼 체크됨" 상태로 제시하고, 사용자가 원치 않는
컬럼만 체크 해제하는 **확인 화면**으로 둔다 (등록이 아니라 확인/조정).
- `valueType: CATEGORY`인 컬럼은 필터 UI에서 자유입력 대신 `SELECT DISTINCT` 결과를
  드롭다운으로 보여줌 (오타 방지, 실제 존재값만 노출).

---

## 3. 조인 규칙 정형화

| 조합 | 조인 방식 | 비고 |
|---|---|---|
| STATE - STATE | 단순 키 조인 (`ON a.id = b.fk`) | 별도 조건 불필요 |
| STATE - HISTORY | 키 조인 + 최신값 여부 선택 | 최신만: `end_date IS NULL` 우선, 없으면 `MAX(date)` |
| HISTORY - HISTORY | 키 조인 + 시점/구간 조건 필요 | POINT가 RANGE 구간 안에 있는지 `BETWEEN` 체크 |

### Strategy 패턴으로 구현

```java
public interface JoinStrategy {
    String buildSql(TableMeta left, TableMeta right, JoinKey key);
}

public class StateStateJoinStrategy implements JoinStrategy { ... }
public class StateHistoryJoinStrategy implements JoinStrategy { ... }
public class HistoryHistoryJoinStrategy implements JoinStrategy { ... }

public class JoinStrategyFactory {
    public JoinStrategy resolve(TableType left, TableType right) {
        if (left == STATE && right == STATE) return new StateStateJoinStrategy();
        if (left == STATE || right == STATE)  return new StateHistoryJoinStrategy();
        return new HistoryHistoryJoinStrategy();
    }
}
```

### 잘못된 조인 vs 올바른 조인 예시

```sql
-- 잘못된 조인 (vehicle_id만 사용)
SELECT * FROM ownership_history o
JOIN service_history s ON o.vehicle_id = s.vehicle_id;
-- 문제: 소유 기간과 무관한 정비 기록까지 다 붙음

-- 올바른 조인 (구간 조건 포함)
SELECT * FROM ownership_history o
JOIN service_history s
  ON o.vehicle_id = s.vehicle_id
  AND s.service_date BETWEEN o.start_date AND COALESCE(o.end_date, CURRENT_DATE);
```

### N개 테이블 조인 처리 방식

그래프 탐색(경로 자동 찾기) 알고리즘은 넣지 않음. 대신 **UX 단에서 제약**:
- 화면에서 테이블을 드래그해서 다른 테이블에 드롭할 때, FK로 직접 연결된 테이블끼리만 연결 성사.
- 연결 안 된 테이블끼리는 드롭이 안 붙음 (또는 안내 메시지).
- 사용자가 순서대로 이어 붙인 테이블 체인을 그대로 SQL로 변환.
- 예: `customer → vehicle → service_history`, `vehicle → ownership_history` 이런 식으로
  손으로 이어붙인 만큼 조인됨 (2개든 4개든 동일한 방식).

---

## 4. 필터 / 세그먼트

### Operator 목록

```java
public enum FilterOperator {
    EQ, NEQ, GT, GTE, LT, LTE,       // 부등호
    LIKE,                             // 문자열 패턴
    IS_NULL, IS_NOT_NULL,             // 널 여부
    WITHIN_LAST_N_DAYS,               // 최근 N일 이내
    OLDER_THAN_N_DAYS                 // N일 이전
}
```

### 필터 구조 — 그룹 내 OR, 그룹 간 AND (2단계, 무한중첩 트리는 안함)

```java
public class SegmentFilter {
    String tableName;
    String column;      // filterableColumns 화이트리스트 검증 대상
    FilterOperator operator;
    String value;
}

public class FilterGroup {
    List<SegmentFilter> filters;  // 그룹 내부는 OR
}

public class SegmentQuery {
    List<FilterGroup> groups;     // 그룹끼리는 AND
}
```

예: `(정비이력 최근 30일 이내 OR 클레임 최근 30일 이내) AND (현재 소유중 = true)`

- 필터 개수 제한: 추후 결정 (메모만 해둠, MVP에서는 제한 없이 시작)
- **필터 대상 테이블 범위**: 2단계(관계도&조인)에서 구성한 조인 체인에 포함된 테이블만 필터 후보로 노출.
  체인 밖 테이블의 컬럼은 필터에 사용할 수 없음 — 조인 체인과 필터 대상을 동일 개념으로 취급.

### N_DAYS 계열 처리 — aggregate 레벨, EXISTS 서브쿼리

"그 고객/차량의 히스토리 전체를 통틀어 최근 N일 이내에 하나라도 있는지" 기준 (단순 최신값 한 건이 아님).
고객은 차량을 여러 대 가질 수 있으므로(1:N), 고객 기준 세그먼트라면 `vehicle`을 한 단계 거쳐야 함.

```sql
SELECT c.*
FROM customer c
WHERE EXISTS (
    SELECT 1 FROM service_history s
    JOIN vehicle v ON v.vehicle_id = s.vehicle_id
    WHERE v.current_owner_id = c.customer_id
    AND s.service_date >= CURRENT_DATE - INTERVAL '30 days'
);
```

- 필터 대상 컬럼이 HISTORY 테이블 소속이면 자동으로 EXISTS 서브쿼리로 감쌈 (조인 체인을 따라 연결)
- 필터 대상 컬럼이 STATE 테이블 소속이면 단순 WHERE절

---

## 5. 화면 플로우 (4단계)

세그먼트를 뽑을 때 실제로는 "이런 조건으로 찾고 싶다"가 먼저 있고 조인은 그 결과물이라, 조인
설계(관계도&조인)보다 조건 선택을 먼저 하도록 순서를 잡았다. 자유입력(자연어 파싱)은 여전히
범위 밖(9번)이라, "조건 먼저"는 전체 테이블의 filterableColumns를 검색해서 담는 방식으로 구현—
장바구니처럼 담은 필드의 소속 테이블을 다음 화면에서 자동으로 조인해준다.

1. **테이블 확인** — DB 스키마 조회 + 컨벤션으로 type/historySubType/foreignKeys 자동 판정된 테이블 목록 표시, filterableColumns만 기본값(PK/FK 제외 전체)에서 사용자가 체크 해제로 조정

2. **조건 선택 (필드 장바구니)**
   - 전체 테이블의 filterableColumns를 `테이블명.컬럼명` 형태로 검색 가능한 리스트로 표시
     (테이블 소속을 컬럼명과 함께 노출 — 예: `order.order_date`처럼 맥락이 유지되게)
   - 클릭해서 담으면 operator(컬럼 valueType에 따라 후보 제한: CATEGORY→EQ/NEQ,
     DATE→WITHIN_LAST_N_DAYS/OLDER_THAN_N_DAYS/GT/LT, NUMBER→부등호, FREE_TEXT→LIKE) + 값 입력
   - (MVP 단순화) 그룹(OR/AND 2단계)은 1차 구현에서 생략, 전부 AND로 묶임 — 그룹 UI는 후속 작업
   - (MVP 단순화) CATEGORY 컬럼의 `SELECT DISTINCT` 드롭다운도 후속 작업, 우선 텍스트 입력

3. **관계도 & 조인**
   - 2단계에서 담긴 필드들의 소속 테이블이 화면 진입과 동시에 캔버스에 자동 배치되고,
     FK/공유키로 연결 가능한 것끼리는 자동으로 이어짐 (드롭할 때마다 전체 미연결 노드를
     재확인해서, 다리 역할 테이블이 나중에 추가돼도 기존 고립 노드가 뒤늦게 붙을 수 있음)
   - 자동으로 못 이은 경우(중간 테이블이 필요한 경우)는 경고 배너로 안내하고, 사용자가
     직접 중간 테이블을 드래그해서 이어줌 — 그래프 자동경로탐색(9번에서 제외)은 여전히 안 함,
     "한 홉 자동연결 + 막히면 사용자에게 알림"으로 절충
   - 테이블 목록에서 캔버스로 드래그해서 수동으로 테이블을 추가/보완하는 것도 가능
   - 조인 방식(STATE-STATE / STATE-HISTORY / HISTORY-HISTORY)은 `JoinStrategyFactory`가
     타입 조합을 보고 자동 결정, 사용자 입력 불필요
   - 예외: STATE-HISTORY 조인은 "최신값만 볼지" 여부가 선택 가능한 지점이라, 엣지에 토글
     하나만 노출 (기본값 ON = 최신값만)
   - 결과물: 순서 있는 테이블 체인 → `POST /joins` (생성 SQL + 샘플 결과 5행을 함께 반환)

4. **세그먼트 결과** — `POST /segments` 호출 → 매칭된 루트 테이블(대부분 customer) row 목록 +
   요약 통계(대상 수, 전체 대비 %). 더미데이터 규모(30명)상 페이지네이션 없이 리스트로 충분

**데이터 미리보기**: 위 스텝과 별개로, 화면 우측 상단(스텝 네비게이션 아래)에 고정된 미리보기
패널을 두고 스텝이 바뀌어도 같은 자리에서 내용만 갱신됨 — 1단계는 선택한 테이블의 샘플 로우,
3단계는 조인 결과 SQL+샘플 로우. 콘텐츠 길이가 스텝마다 달라서 인라인에 두면 위치가 들쭉날쭉
해지는 문제가 있어 앱 레벨 고정 레이아웃으로 뺐다.

---

## 6. 기술 스택

- **Backend**: Spring Boot 3.x, JPA (Spring Data JPA)
- **DB**: PostgreSQL
- **Frontend**: React, 관계도 시각화는 React Flow 계열 라이브러리 검토
- **API 예시**
  - `GET /tables/discover` — DB 스키마 조회 + 컨벤션으로 type/historySubType/foreignKeys
    자동 판정된 테이블 목록 반환 (필터 화면 확인용, 등록 아님)
  - `POST /tables/{name}/filterable-columns` — 자동 판정 결과 중 filterableColumns만
    사용자가 조정한 값으로 저장
  - `GET /tables/{name}/preview` — 해당 테이블 샘플 5행 (컬럼명은 결과 0건이어도 반환)
  - `POST /joins` — 조인 체인 검증 + SQL 생성, 그 SQL을 실행한 샘플 결과 5행까지 함께 반환
    (별도 실행 API 없이 한 번에 미리보기까지 제공)
  - `POST /segments` — 필터(SegmentQuery) 적용 → 세그먼트 결과 조회
  - `GET /tables/{name}/columns/{column}/distinct-values` — CATEGORY 컬럼 드롭다운용 (미구현,
    현재는 값 입력을 텍스트로 대체)

---

## 7. 성능/운영 고려사항

- **인덱스**: 히스토리 테이블의 `(vehicle_id, date컬럼)` 복합 인덱스 필수 — EXISTS 서브쿼리가 이 조합으로 계속 조회됨
- **실행계획 확인**: `EXPLAIN ANALYZE`로 조인 조건별 성능 확인, README에 근거 기록 (자격요건의 "성능 트레이드오프 고민" 직접 증명)
- **JPA 사용 시 fetch 전략**: LAZY/EAGER 명확히 정의, N+1 이슈 점검

---

## 8. 더미 데이터 규모 (제안)

- `customer`: 30명
- `dealer`: 5개 지점
- `vehicle`: 40대 (일부 고객은 차량 2대 이상 소유 이력 있게)
- `ownership_history`: 차량당 1~3건 (소유권 이전 있는 케이스 포함)
- `service_history`: 차량당 3~8건, 날짜 분산 (최근 30일 이내 포함되는 것도 일부 섞기)
- `warranty_claim_history`: 차량당 0~3건, claim_type은 [엔진, 배터리, 내장재, 전장, 기타] 중 랜덤
- `price_history`: 차량당 3~6건, 시간 흐름에 따라 자연스럽게 변동

세그먼트 필터로 걸었을 때 "결과가 0건도 아니고 전체도 아닌" 의미 있는 분포가 나오도록 구성.

---

## 9. 범위에서 제외한 것 (명시적 확정)

- 다대다(N:N) 관계
- 필터 자유입력 (화이트리스트로 대체)
- 그룹 무한 중첩 트리 (그룹 내 OR, 그룹 간 AND 2단계로 제한)
- 그래프 자동 경로 탐색 (드래그앤드롭 UX 제약으로 대체)
- 조인 체인 밖 테이블의 필터링 (조인 체인에 포함된 테이블만 필터 후보)
- **언피벗/EAV형 테이블** (예: `metric_name, metric_value`처럼 속성 이름 자체가 값으로 들어가
  여러 지표가 한 컬럼에 섞이는 구조). 이런 테이블은 필터링하려면 동적 PIVOT 로직이 필요해서
  filterableColumns 화이트리스트 모델 자체가 안 맞음. STATE/HISTORY 두 축으로 스코프 고정.
  (참고: 주문이력처럼 단일 속성(예: `status`)이 시간에 따라 바뀌는 로그는 EAV가 아니라
  기존 POINT-type HISTORY로 정상 커버됨 — 새 타입 불필요)

---

## 10. 이력서/면접 어필 포인트

- "테이블의 성격(상태성/히스토리성, 시점형/구간형)에 따라 조인 전략이 달라진다"는 문제의식은
  실무(반정규화 테이블 설계, 데이터마트 설계) 경험에서 도출
- 단순 CRUD가 아니라 **도메인 로직이 있는 조인 규칙 엔진**을 Strategy 패턴으로 직접 설계
- SQL 인젝션 방어를 위한 화이트리스트 컬럼 검증 등 보안 고려
- 인덱스/실행계획 확인 등 성능 트레이드오프 고민 근거 보유
- "왜 이 구조여야 했는지" 질문에 실제 사례(잘못된 조인의 예)로 구체적 답변 가능
