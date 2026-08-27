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

1. **테이블 등록** — 테이블 선택, 타입(STATE/HISTORY) 및 historySubType(POINT/RANGE) 지정, filterableColumns 지정
2. **관계도 & 조인** — 등록된 FK 기반 관계도 시각화, 드래그앤드롭으로 조인 체인 구성 (FK 연결된 것만 허용)
3. **필터 (세그먼트 조건)** — 조인 체인에 포함된 테이블의 컬럼만 후보로 노출. 그룹별 OR 조건 추가, 그룹 간 AND로 결합. CATEGORY 타입 컬럼은 `SELECT DISTINCT` 드롭다운
4. **세그먼트 결과** — 조건을 통과한 고객 리스트 + 요약 통계(대상 수 등)

---

## 6. 기술 스택

- **Backend**: Spring Boot 3.x, JPA (Spring Data JPA)
- **DB**: PostgreSQL
- **Frontend**: React, 관계도 시각화는 React Flow 계열 라이브러리 검토
- **API 예시**
  - `POST /tables` — 테이블 메타데이터 등록
  - `POST /joins` — 조인 체인 등록 (드래그앤드롭으로 이어진 테이블 순서)
  - `POST /segments` — 필터(SegmentQuery) 적용 → 세그먼트 결과 조회
  - `GET /tables/{name}/columns/{column}/distinct-values` — CATEGORY 컬럼 드롭다운용

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

---

## 10. 이력서/면접 어필 포인트

- "테이블의 성격(상태성/히스토리성, 시점형/구간형)에 따라 조인 전략이 달라진다"는 문제의식은
  실무(반정규화 테이블 설계, 데이터마트 설계) 경험에서 도출
- 단순 CRUD가 아니라 **도메인 로직이 있는 조인 규칙 엔진**을 Strategy 패턴으로 직접 설계
- SQL 인젝션 방어를 위한 화이트리스트 컬럼 검증 등 보안 고려
- 인덱스/실행계획 확인 등 성능 트레이드오프 고민 근거 보유
- "왜 이 구조여야 했는지" 질문에 실제 사례(잘못된 조인의 예)로 구체적 답변 가능
