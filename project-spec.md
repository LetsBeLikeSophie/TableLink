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
- 필터 UI에서 자유입력 대신 드롭다운을 보여줄지는 정적 `valueType`이 아니라 **실제 데이터의
  카디널리티로 즉석 판단**한다 — `GET /tables/{name}/columns/{column}/domain` 호출 결과
  distinct 값이 30개 미만(닫힌 집합)이면 그 값들로 드롭다운, 30개(쿼리 캡)면 열린 집합으로
  보고 텍스트 입력 유지. valueType은 NUMBER/DATE 범위 조회(min~max)를 결정하는 데만 쓰임
  (5번 화면 플로우 1단계 참고).

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

### N개 테이블 조인 처리 방식 (수정: 자동 경로탐색으로 전환)

**최초 설계는 그래프 탐색(경로 자동 찾기) 알고리즘을 넣지 않고 드래그앤드롭 UX 제약으로 대체하는
것이었으나, 실제 사용해보니 문제가 있었다** — 조건 선택(장바구니) 방식으로 필드를 먼저 고르는
흐름에서는 사용자가 두 테이블 사이에 중간 테이블이 몇 개나 필요한지, 어떤 테이블을 거쳐야
하는지 미리 알기 어려웠다 (예: customer 필드 + dealer 필드를 골랐을 때, 실제로는
`customer → vehicle(또는 ownership_history) → service_history → dealer`처럼 2홉을 거쳐야
연결되는데 "중간 테이블을 연결해주세요"라는 안내만으로는 뭘 추가해야 할지 알 수 없었음).

**결론: 이 스키마 규모(7개 테이블)에서는 그래프 탐색이 실제로 비싸지 않다.** FK/공유키로
연결 가능한 테이블 쌍 전체를 인접 그래프로 놓고 보면, `vehicle`을 허브로 7개 테이블이
전부 하나의 연결 그래프를 이루므로 BFS 최단경로면 충분하고, 별도의 무거운 그래프 알고리즘
(A*, 다익스트라 등)이나 사용자 확인 없는 임의 조인 폭발 위험도 없다. 그래서:

- 사용자가 조건 선택(2단계)에서 고른 필드들의 소속 테이블 = "필요 테이블 집합"
- 필요 테이블 집합을 그리디 Steiner-tree 근사로 연결: 이미 포함된 테이블들 기준으로 아직
  연결 안 된 필요 테이블 중 BFS 최단경로가 가장 짧은 것부터 순서대로 병합, 경로상의 중간
  테이블(사용자가 직접 고르지 않은 것)도 함께 포함
- 자동으로 추가된 중간 테이블은 화면에 점선 테두리 + "연결을 위해 다음 테이블을 자동으로
  추가했어요: X, Y" 안내 배너로 명시 (사용자가 왜 그 테이블이 생겼는지 알 수 있게)
- 여전히 안 하는 것: 사용자가 명시적으로 고르지 않은 테이블을 조건 후보로 자동 추천하거나,
  N:N 관계 조인, 조인 폭발 방지를 위한 조인 개수 제한 — 순수 "필요한 만큼만 최단경로로 연결"
  까지만 자동화
- 테이블 목록에서 캔버스로 드래그해서 수동으로 테이블을 추가하는 것도 여전히 가능 (그 경우도
  기존 캔버스 상태 기준으로 동일한 자동연결 로직이 적용됨)

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

## 5. 화면 플로우 (2단계 — 테이블 확인 단계 제거, 조인은 조건 선택 화면에 통합)

세그먼트를 뽑을 때 실제로는 "이런 조건으로 찾고 싶다"가 먼저 있고 조인은 그 결과물이라, 조인
설계보다 조건 선택을 먼저 하도록 순서를 잡았다. 자유입력(자연어 파싱)은 여전히 범위 밖(9번)
이라, "조건 먼저"는 전체 테이블의 filterableColumns를 검색해서 담는 방식으로 구현—장바구니처럼
담은 필드의 소속 테이블을 자동으로 조인해준다.

기존에 있던 "테이블 확인"(수동 등록/확인) 단계는 제거했다 — 조건 선택 화면이 어차피
자동 판정된 filterableColumns 기본값을 그대로 검색 대상으로 쓰기 때문에, 별도로 먼저 확인하고
저장하는 화면을 거치게 할 이유가 없었음. `TableMetaService`/`POST /tables/{name}/filterable-columns`
같은 백엔드 커스터마이징 기능 자체는 남겨뒀고, `TableConfirmStep.jsx`도 삭제하지 않았음 —
나중에 "고급 설정"류 화면으로 다시 노출할 수도 있어서.

**관계도&조인도 별도 스텝에서 조건 선택 화면 하단으로 통합**했다 — BFS 자동연결(3번 참고) 이후
조인 단계는 사용자가 내릴 결정이 거의 없어져서(최신값만 토글 정도), 매번 다른 페이지로 이동해서
"확인"만 하고 오는 흐름이 실제로는 조건 화면과 계속 왔다갔다하게 만드는 마찰이었음. 이제 조건을
담으면 그 아래 관계도가 실시간으로 갱신되고, 우측 고정 사이드바에 SQL+샘플 데이터까지 바로
보인다 — 페이지 전환 없이 한 화면에서 조건↔조인 결과를 계속 오가며 다듬을 수 있음.

1. **조건 선택 & 조인 (한 화면)**
   - 상단: 전체 테이블의 filterableColumns(자동 판정된 기본값)를 `테이블명.컬럼명` 형태로
     검색 가능한 리스트로 표시 (테이블 소속을 컬럼명과 함께 노출 — 예: `order.order_date`처럼
     맥락이 유지되게). 각 필드 옆 (i) 아이콘에 마우스를 올리면 실제 값 도메인을 보여줌
     (CATEGORY성 컬럼은 distinct 값 목록, NUMBER/DATE는 min~max 범위) — `GET
     /tables/{name}/columns/{column}/domain`
   - 클릭해서 담으면 operator(컬럼 valueType에 따라 후보 제한: CATEGORY→EQ/NEQ,
     DATE→WITHIN_LAST_N_DAYS/OLDER_THAN_N_DAYS/GT/LT, NUMBER→부등호, FREE_TEXT→LIKE) + 값 입력.
     담긴 필드의 실제 distinct 값이 30개 미만(닫힌 집합)이면 값 입력이 텍스트 대신 그 값들로
     채워진 드롭다운으로 자동 전환됨 (30개는 백엔드 쿼리 캡이라, 정확히 30개가 왔다는 건
     "그 이상일 수 있다"는 뜻이라 텍스트 입력 유지 — valueType이 CATEGORY로 미리 정해져
     있어야 하는 게 아니라 실제 데이터의 카디널리티로 즉석 판단). 닫힌 집합으로 판정되면
     operator 후보도 EQ/NEQ 둘로 줄어듦 — 정해진 값 중 하나를 고르는 필드에 LIKE/IS_NULL은
     의미가 없어서 (이미 선택 자체가 not-null)
   - 담긴 조건은 그대로 값 도메인 확인용이 아니라 **실제 미리보기 WHERE절**로 적용됨 —
     조인 결과 미리보기(하단 참고)가 조건 값을 넣는 즉시 그 조건으로 필터링된 5행을 다시
     보여줌 (`POST /joins`의 `filters` 필드, 값 없는 조건은 서버로 안 보냄)
   - (MVP 단순화) 그룹(OR/AND 2단계)은 1차 구현에서 생략, 전부 AND로 묶임 — 그룹 UI는 후속 작업
   - 하단: 담긴 필드들의 소속 테이블 = "필요 테이블 집합"을 그리디 Steiner-tree 근사(3번
     "N개 테이블 조인 처리 방식" 참고)로 자동 연결한 관계도. 조건이 바뀔 때마다 실시간 갱신,
     중간에 필요한 다리 테이블까지 자동으로 채워짐 — 더 이상 "연결 안 됨" 상태로 남지 않음
     (이 스키마는 7개 테이블이 전부 하나로 연결돼 있어서)
   - 자동으로 추가된 중간 테이블은 점선 테두리 + 안내 배너("연결을 위해 다음 테이블을 자동으로
     추가했어요: X, Y")로 명시
   - "+ 테이블 직접 추가" 드롭다운으로 조건에 안 걸린 테이블도 수동으로 끼워넣을 수 있음
     (컨텍스트용 컬럼이 필요할 때 등) — 그 경우도 동일한 자동연결 로직 적용
   - 조인 방식(STATE-STATE / STATE-HISTORY / HISTORY-HISTORY)은 `JoinStrategyFactory`가
     타입 조합을 보고 자동 결정, 사용자 입력 불필요
   - 예외: STATE-HISTORY 조인은 "최신값만 볼지" 여부가 선택 가능한 지점이라, 엣지에 토글
     하나만 노출 (기본값 ON = 최신값만)
   - 결과물: 순서 있는 테이블 체인 → `POST /joins` (생성 SQL + 샘플 결과 5행을 함께 반환,
     조건이 바뀔 때마다 자동 재호출)

2. **세그먼트 결과 (완성)** — `POST /segments` 호출 → 매칭된 루트 테이블(1단계 관계도의 첫 번째
   테이블, 대부분 customer) row 목록 + 요약 통계(대상 수 / 전체 수, 전체 대비 %). 루트 테이블의
   컬럼만 `DISTINCT`로 반환 (조인된 다른 테이블 컬럼은 안 섞음 — 미리보기와 달리 "그 조건에
   해당하는 대상이 누구인지"가 목적이라 1행=1대상이어야 함). 더미데이터 규모(30명)상 페이지네이션
   없이 리스트로 충분
   - `POST /segments` 요청 형식은 `POST /joins`와 동일(`rootTable`/`edges`/`filters`) — 1단계
     관계도에서 만든 체인을 그대로 재사용
   - `edges`가 비어있어도(테이블 1개, 조인 불필요) 동작함 — 애초에 조인 자체가 필요 없는 단순
     "customer.name LIKE ..." 같은 케이스도 커버해야 해서, `rootTable`을 `edges[0]`에서
     추론하던 것을 명시적 필드로 바꿈

**데이터 미리보기**: 화면 우측 상단(스텝 네비게이션 아래)에 고정된 미리보기 패널을 두고 스텝이
바뀌어도 같은 자리에서 내용만 갱신됨 — 1단계는 조인 결과 SQL+샘플 로우(조건 바뀔 때마다 자동
갱신). 콘텐츠 길이가 스텝마다 달라서 인라인에 두면 위치가 들쭉날쭉해지는 문제가 있어 앱 레벨
고정 레이아웃으로 뺐다. 미리보기 테이블의 컬럼 헤더를 클릭하면 그 자리에 엑셀 자동필터 스타일
팝오버가 떠서 바로 조건을 완성할 수 있음(값 도메인이 닫힌 집합이면 드롭다운) — 검색 리스트로
필드를 먼저 찾아 담는 것 말고도, "지금 보고 있는 데이터에서 바로" 조건을 만드는 경로.

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
  - `POST /segments` — (구현 완료) 필터(SegmentQuery) 적용 → 매칭된 루트 테이블 row(DISTINCT) +
    matchedCount/totalCount/matchedPercentage. 요청 형식은 `POST /joins`와 동일
    (`rootTable`/`edges`/`filters`)
  - `GET /tables/{name}/columns/{column}/domain` — 값 도메인 조회. NUMBER/DATE는
    `{min, max}`, 나머지는 distinct 값 최대 30개(`values`) — 프론트가 30개 미만이면
    드롭다운, 30개면 텍스트 입력으로 판단하는 데 씀

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
- 필터 자유입력 (화이트리스트로 대체 — 단, 조건 선택 화면의 필드 검색은 자유입력이 아니라
  기존 filterableColumns 화이트리스트 안에서 검색/필터링하는 것이라 이 원칙과 안 어긋남)
- 그룹 무한 중첩 트리 (그룹 내 OR, 그룹 간 AND 2단계로 제한)
- 조인 체인 밖 테이블의 필터링 (조인 체인에 포함된 테이블만 필터 후보)
- ~~그래프 자동 경로 탐색~~ → **번복, 구현함** (3번 "N개 테이블 조인 처리 방식" 참고). 조건
  선택을 먼저 하는 흐름으로 바뀌면서 "중간 테이블을 직접 찾아 이어달라"는 요구가 비현실적임이
  드러났고, 이 스키마 규모(7개 테이블)에서는 BFS 기반 최단경로가 실제로는 비싸지 않아서 제외
  사유가 더 이상 유효하지 않았음
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
