# TableLink

여러 테이블을 자동으로 탐지하고 조인 경로를 스스로 찾아, 조건만으로 고객 세그먼트를 뽑아내는 도구입니다.

**Live**: [itssophie.dev/tablelink](https://itssophie.dev/tablelink/)

---

## 왜 만들었나

실무에서 반정규화 테이블·데이터마트를 다루다 보면, "이 테이블을 어떻게 조인해야 하는가"가
매번 감으로 결정되는 게 아니라 사실 테이블의 **성격**에 달려있다는 걸 느꼈습니다.

- 고객, 차량처럼 **현재 상태만 유지하는 테이블(STATE)** 은 단순 키 조인이면 충분하지만
- 소유 이력, 정비 이력처럼 **시간에 따라 로그가 쌓이는 테이블(HISTORY)** 을 STATE 테이블과
  조인할 때는 "최신값만 볼 것인가"를 결정해야 하고
- HISTORY 테이블끼리 조인할 때는 단순 키 조인만으로는 틀린 결과가 나옵니다.

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

이 문제의식을 "테이블의 성격(STATE/HISTORY, 구간형/시점형)에 따라 조인 전략이 정형화된다"는
규칙으로 정리하고, 그 규칙을 사람이 매번 판단하는 대신 도구가 대신 적용하도록 만든 것이
TableLink입니다.

---

## 설계가 바뀐 지점들

처음 생각한 설계가 실제로 써보니 틀렸던 부분들이 있었고, 그때마다 왜 틀렸는지를 기준으로
다시 설계했습니다.

### 1. "테이블 등록" 화면 → 스키마 자동 판정

처음에는 사용자가 테이블을 하나씩 등록하면서 STATE/HISTORY 타입을 직접 지정하는 화면을
생각했습니다. 그런데 이 정보(테이블 성격, PK/FK, 컬럼 타입)는 전부 DB 스키마에 이미 있는
정보였습니다. 그래서 `information_schema`를 조회하고 네이밍 컨벤션(`_history`로 끝나면
HISTORY, `end_date`류 컬럼이 있으면 RANGE)으로 자동 판정하도록 바꿨습니다. 사용자가 직접
입력하는 건 "이 컬럼을 필터로 노출해도 되는가"라는, 자동으로는 판단할 수 없는 화이트리스트뿐입니다.

### 2. "그래프 경로 탐색은 안 한다" → 번복하고 BFS로 구현

처음엔 자동 경로 탐색(그래프 알고리즘) 없이, 사용자가 드래그앤드롭으로 중간 테이블까지
직접 연결하게 하려고 했습니다. "복잡한 알고리즘 없이 UX 제약으로 대체"하려는 의도였는데,
실제로 조건(필드)을 먼저 고르는 흐름으로 화면을 바꾸고 나니 문제가 드러났습니다 —
`customer` 필드와 `dealer` 필드를 동시에 골랐을 때, 이 둘을 연결하려면 몇 개의 테이블을
거쳐야 하는지 사용자가 미리 알 방법이 없었습니다. "중간 테이블을 연결해주세요"라는 안내만으론
뭘 추가해야 하는지 알 수 없는 상황이었던 거죠.

다시 보니 이 스키마 규모(테이블 7개)에서는 그래프 탐색이 전혀 무겁지 않았습니다. FK/공유키로
연결 가능한 테이블 쌍을 인접 그래프로 놓으면 `vehicle`을 허브로 전부 하나로 연결되어 있어서,
BFS 최단경로 기반 그리디 Steiner-tree 근사만으로 충분했습니다. 그래서 선택한 필드들의 소속
테이블(필요 테이블 집합)을 BFS로 자동 연결하고, 사용자가 고르지 않은 중간 테이블은 점선
테두리 + 안내 배너로 "왜 이 테이블이 여기 있는지"를 명시하는 방식으로 바꿨습니다.

### 3. 조인 화면과 조건 화면을 분리 → 한 화면으로 병합

BFS 자동연결이 들어오면서 조인 단계에서 사용자가 내릴 결정이 "최신값만 볼지" 토글 정도로
줄었습니다. 그런데도 별도 페이지로 분리해 두니, 조건을 하나 바꿀 때마다 조인 화면으로
이동해서 "확인만 하고" 다시 돌아오는 왕복이 계속 발생했습니다. 그래서 관계도를 조건 선택
화면 하단에 실시간으로 갱신되는 패널로 합쳤습니다 — 페이지 전환 없이 조건과 조인 결과를
계속 오가며 다듬을 수 있게 됐습니다.

---

## 실제로 겪은 버그

### 필터 값의 암묵적 타입 — `integer < character varying`

숫자/날짜 컬럼에 `>`, `<` 조건을 걸면 Postgres가 타입 불일치로 요청을 거부했습니다. JDBC가
모든 필터 값을 텍스트로 바인딩하다 보니, `=`는 넘어가도 부등호 비교에서는 "정수와 문자열은
비교할 연산자가 없다"는 오류가 났던 것입니다. 컬럼의 실제 타입(`information_schema`에서 조회한
`data_type`)을 알아내 `?::integer`, `?::date`처럼 바인드 파라미터에 명시적으로 캐스팅을
붙이도록 고쳤습니다.

### "최신값만" 조건이 두 번 겹쳐서 결과가 사라짐

멀티홉 조인에서 HISTORY 테이블(예: `service_history`)이 먼저 STATE 테이블(`vehicle`)과
조인되며 "차량별 최신 정비 기록"으로 좁혀진 뒤, 같은 테이블이 또 다른 STATE 테이블
(`dealer`)로 한 번 더 연결되는 경로가 있었습니다. 자동연결 로직이 이 두 번째 연결에도
기본으로 "최신값만" 조건을 붙이면서 "이 딜러에서 가장 최근에 한 정비 기록"이라는, 원래
의도와 무관한 조건이 AND로 겹쳐 결과가 10건 이하로 사라지는 문제가 있었습니다. "최신값만"
narrowing은 HISTORY 테이블이 트리에 새로 들어올 때(= 이미 자리 잡은 STATE 쪽에서 바라볼 때)만
기본으로 켜지도록 규칙을 바꿔 해결했습니다.

### 세그먼트 결과의 분모 문제

세그먼트 화면은 항상 "전체 고객 대비 몇 %"를 보여줘야 하는데, 조인 트리의 루트가 조건을
어떤 순서로 골랐는지에 따라 바뀌는 구조였습니다. 딜러 조건을 먼저 걸면 결과가 "전체 9개
딜러 중 N개"로 나오는 식이었죠. `customer`를 조건 순서와 무관하게 항상 조인 트리의 루트로
고정해서, 세그먼트 결과는 항상 고객 수 기준으로 계산되도록 고쳤습니다.

---

## 기술 스택

- **Backend**: Spring Boot 4.1.1 (Java 21), Spring Data JPA, JdbcTemplate
- **DB**: PostgreSQL 16 — `information_schema` 조회로 스키마 자동 판정
- **Frontend**: React 19, Vite, React Flow(`@xyflow/react`)로 관계도 시각화

### 아키텍처 포인트

- 조인 SQL 생성은 Strategy 패턴(`JoinStrategy` / `JoinStrategyFactory`)으로 STATE-STATE,
  STATE-HISTORY, HISTORY-HISTORY 세 가지 케이스를 분리
- 필터는 컬럼명을 화이트리스트(`filterableColumns`)로 검증한 뒤에만 SQL에 사용 — 컬럼명은
  PreparedStatement 파라미터 바인딩이 불가능한 자리라 화이트리스트로 방어
- 히스토리 테이블의 `(vehicle_id, date컬럼)` 복합 인덱스 — EXISTS 서브쿼리/최신값 조회가
  이 조합으로 계속 실행되기 때문

더 자세한 설계 배경은 [project-spec.md](project-spec.md)에 정리되어 있습니다.

---

## 로컬 실행

```bash
# DB
docker run --name tablelink-postgres -e POSTGRES_DB=tablelink \
  -e POSTGRES_USER=tablelink -e POSTGRES_PASSWORD=tablelink \
  -p 5432:5432 -d postgres:16

# Backend (8080)
cd backend && ./mvnw spring-boot:run

# Frontend (5173, /tables /joins /segments는 8080으로 프록시)
cd frontend && npm install && npm run dev
```

## 배포

`itssophie.dev` 도메인 아래 `/tablelink` 경로로 배포되어 있고, Oracle Cloud 무료 티어
인스턴스 두 대(엣지: DNS/TLS/포트폴리오 홈, 오리진: 백엔드+DB 전용)로 역할을 분리했습니다.
자세한 내용은 [project-spec.md의 배포 섹션](project-spec.md#11-배포)을 참고하세요.
