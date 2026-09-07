# TableLink

여러 테이블을 자동으로 탐지하고 조인 경로를 스스로 찾아, 조건만으로 고객 세그먼트를 뽑아내는 도구입니다.

**Live**: [itssophie.dev/tablelink](https://itssophie.dev/tablelink/)

---

## 왜 만들었나

실무에서 세그먼트 도구를 다루다 보면 흔한 방식이 있습니다: 카테고리(도메인)별로 원본
테이블들을 미리 반정규화해서 넓은 마트 테이블 하나로 만들고, 그 마트에 고객 키를 항상
포함시켜 마트끼리는 고객 키로 조인만 하면 되게 만드는 방식입니다. 조인 자체는 쉬워지지만,
세그먼트 조건에 새 카테고리를 추가할 때마다 그 카테고리의 마트를 새로 설계·구축해야 합니다.
테이블 구조를 마음대로 바꾸기 어려운 현업에서는 이게 매번 상당한 비용입니다 — ETL을 새로
짜야 하고, 데이터가 중복 저장되며, 배치 주기만큼 최신성이 떨어집니다.

TableLink는 반대 방향을 택했습니다. 마트를 미리 만들어두는 대신 원본 정규화 스키마를 그대로
두고, 테이블의 성격(현재값만 유지하는 STATE, 시간에 따라 쌓이는 HISTORY)에 따라 조인 전략을
자동으로 정하고 조건에 필요한 조인 경로도 그때그때 찾습니다. 새 테이블이 추가돼도 마트를
새로 만들 필요 없이 바로 세그먼트 조건으로 쓸 수 있습니다.

```sql
-- 단순 키 조인만으로는 틀린 결과가 나오는 경우 (HISTORY-HISTORY)
SELECT * FROM ownership_history o
JOIN service_history s ON o.vehicle_id = s.vehicle_id;
-- 문제: 소유 기간과 무관한 정비 기록까지 다 붙음

-- 올바른 조인 (구간 조건 포함)
SELECT * FROM ownership_history o
JOIN service_history s
  ON o.vehicle_id = s.vehicle_id
  AND s.service_date BETWEEN o.start_date AND COALESCE(o.end_date, CURRENT_DATE);
```

---

## 설계가 바뀐 지점들

- **테이블 등록 화면 → 스키마 자동 판정**: 처음엔 사용자가 테이블 성격(STATE/HISTORY)을
  직접 입력하게 했지만, 이 정보는 이미 DB 스키마에 있었습니다. `information_schema` 조회 +
  네이밍 컨벤션으로 자동 판정하도록 바꾸고, 사람이 정할 몫은 "필터로 노출할 컬럼
  화이트리스트"만 남겼습니다.
- **그래프 탐색 없이 간다 → 번복**: 처음엔 드래그앤드롭으로 중간 테이블까지 사용자가 직접
  잇게 하려 했지만, 조건(필드)을 먼저 고르는 흐름에서는 몇 테이블을 거쳐야 연결되는지
  사용자가 미리 알 수 없었습니다. 이 규모(테이블 7개)에서는 그래프 탐색이 전혀 무겁지 않다는
  걸 확인하고, BFS 최단경로 기반 자동 연결로 바꿨습니다.
- **조인 화면과 조건 화면 분리 → 병합**: 자동 연결이 들어오자 조인 화면에서 사용자가 내릴
  결정이 "최신값만 볼지" 토글 정도로 줄었는데도, 조건 하나 바꿀 때마다 페이지를 오갔습니다.
  관계도를 조건 화면 하단의 실시간 갱신 패널로 합쳤습니다.

---

## 실제로 겪은 버그

- **필터 값의 암묵적 타입**: JDBC가 모든 필터 값을 텍스트로 바인딩해서, 숫자/날짜 컬럼에
  `>`/`<`를 걸면 Postgres가 `integer < character varying` 타입 불일치로 거부했습니다.
  컬럼의 실제 타입을 조회해 `?::integer`처럼 명시적으로 캐스팅하도록 고쳤습니다.
- **"최신값만" 조건이 두 번 겹침**: 멀티홉 조인에서 같은 HISTORY 테이블이 두 개의 STATE
  테이블과 연달아 연결될 때, 두 연결 모두에 "최신값만" 조건이 기본으로 붙어 서로 다른
  기준의 narrowing이 AND로 겹치면서 결과가 사라지는 문제가 있었습니다. HISTORY 테이블이
  트리에 새로 들어올 때만 기본으로 켜지도록 고쳤습니다.
- **세그먼트 분모 문제**: 조인 트리의 루트가 조건을 고른 순서에 따라 바뀌어서, 딜러 조건을
  먼저 걸면 결과가 "전체 딜러 대비"로 계산됐습니다. 고객을 조건 순서와 무관하게 항상
  루트로 고정했습니다.

---

## 기술 스택

- **Backend**: Spring Boot 4.1.1 (Java 21), Spring Data JPA, JdbcTemplate
- **DB**: PostgreSQL 16 — `information_schema` 조회로 스키마 자동 판정
- **Frontend**: React 19, Vite, React Flow(`@xyflow/react`)로 관계도 시각화

조인 SQL 생성은 Strategy 패턴(`JoinStrategy`/`JoinStrategyFactory`)으로 STATE-STATE,
STATE-HISTORY, HISTORY-HISTORY 세 케이스를 분리했고, 필터는 컬럼명을 화이트리스트
(`filterableColumns`)로 검증한 뒤에만 SQL에 사용합니다 — 컬럼명은 PreparedStatement
파라미터 바인딩이 불가능한 자리라 화이트리스트로 방어합니다.

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

`itssophie.dev` 도메인 아래 `/tablelink` 경로로 배포되어 있습니다. 자세한 내용은
[project-spec.md의 배포 섹션](project-spec.md#11-배포)을 참고하세요.
