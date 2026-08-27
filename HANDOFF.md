# 세션 인수인계 (2026-08-28)

새 세션에서 작업 이어받을 때 이 파일부터 읽으세요. 프로젝트 스펙은 [project-spec.md](project-spec.md)에 있음(이게 원본 설계 문서, 최종 확정본).

## 폴더/경로 관련 (중요, 헷갈렸던 부분)

- **현재 프로젝트 경로: `C:\Projects\TableLink`** ← 이게 맞는 경로
- 원래 폴더명이 `C:\Projects\segmentation`이었는데 앱 이름에 맞춰 `TableLink`로 바꿈
- 단순 `rename`이 harness/앱이 폴더를 물고 있어서 계속 실패 → robocopy로 복사 후 원본 삭제하는 방식으로 우회함
- **주의**: Claude Code 앱이 예전에 등록된 프로젝트 경로(`segmentation`)를 기억하고 있어서, 세션을 새로 열면 `C:\Projects\segmentation` (빈 폴더로 자동 재생성됨)로 열릴 수 있음. 새 세션 시작할 때 반드시 `C:\Projects\TableLink`를 명시적으로 열 것.
- 이 경로 이슈 때문에 모바일 리모트 컨트롤 세션 목록에서 이 세션이 사라짐 → 원인 불명확, CLI 재시작 등 시도했으나 미해결. 앱 설정에서 프로젝트 재등록이 필요할 수도 있음.

## Git / GitHub

- 로컬 git repo 초기화 완료 (`git init`)
- remote 연결됨: `origin` → `https://github.com/LetsBeLikeSophie/TableLink.git`
- **아직 커밋 안 함** (No commits yet) — 사용자가 "JDK 설치 후 커밋하겠다"고 했었음. 다음 세션에서 첫 커밋 진행하면 됨.

## 완료된 작업

1. **project-spec.md** (v2, 최종 확정) — 아래 내용 전부 반영됨:
   - STATE(customer/dealer/vehicle) vs HISTORY(POINT: service/warranty_claim/price_history, RANGE: ownership_history) 테이블 분류
   - TableMeta 모델 (filterableColumns 화이트리스트 포함, SQL 인젝션 방지용)
   - 조인 규칙: STATE-STATE / STATE-HISTORY / HISTORY-HISTORY, Strategy 패턴으로 구현 예정 (JoinStrategy 인터페이스 + JoinStrategyFactory)
   - N개 테이블 조인은 그래프 탐색 알고리즘 없이 드래그앤드롭 UX로 제약 (FK 연결된 것만 허용)
   - 필터 모델: FilterOperator(EQ/NEQ/GT/GTE/LT/LTE/LIKE/IS_NULL/IS_NOT_NULL/WITHIN_LAST_N_DAYS/OLDER_THAN_N_DAYS), 그룹 내 OR + 그룹 간 AND (2단계, 무한중첩 없음)
   - **필터 대상 테이블은 조인 체인에 포함된 테이블로 한정** (사용자가 (A) 옵션으로 확정함 — 체인 밖 테이블은 필터 후보에 안 나옴)
   - N_DAYS 필터는 EXISTS 서브쿼리로 처리 (단일 로우 값이 아니라 "존재 여부" 기준), 고객 기준이면 vehicle 통해서 조인 필요 (고객:차량 = 1:N)
   - 화면 4단계: 테이블등록 → 관계도&조인 → 필터(세그먼트) → 결과
   - 범위 제외: N:N 관계, 필터 자유입력, 무한중첩 그룹, 그래프 자동경로탐색, 체인 밖 필터링

2. **backend/** — Spring Boot 프로젝트 스캐폴딩 (Spring Initializr로 생성)
   - **Spring Boot 4.1.1** (스펙엔 3.x라 되어있었는데, 2026년 현재 Initializr 기본값이 4.x라 이렇게 됨. Boot 4는 3.x와 차이 있음 — 예: `spring-boot-starter-web` → `spring-boot-starter-webmvc`로 이름 변경. 온라인 자료 대부분 3.x 기준이니 참고)
   - Maven, Java 21, groupId `com.example`, artifactId `tablelink`, 패키지 `com.example.tablelink`
   - 메인 클래스: `TableLinkApplication.java`
   - 의존성: web(webmvc), data-jpa, postgresql, validation
   - `application.properties`: datasource가 docker-compose 값과 일치하도록 설정됨 (`jdbc:postgresql://localhost:5432/tablelink`, user/pass `tablelink`), `spring.jpa.hibernate.ddl-auto=validate`, `spring.sql.init.mode=always`
   - `schema.sql`: project-spec.md 1번 섹션 DDL 그대로 + 성능 섹션(7번)에서 언급한 인덱스(`(vehicle_id, date컬럼)` 복합 인덱스) 포함

3. **docker-compose.yml** — Postgres 16, DB/user/password 전부 `tablelink`

4. **.gitignore** — Java/Maven, IDE, Node, OS, env 파일 커버

5. **JDK 21 설치 완료** — Eclipse Temurin, winget으로 설치함. `java -version` 확인됨, `JAVA_HOME` 자동 설정됨 (`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`)

## 아직 안 한 것 (project-spec.md 6번 MVP 순서 기준)

1. ~~DB 스키마~~ (schema.sql 완료) — **더미 데이터는 아직 없음** (spec 8번 섹션에 규모 제안 있음: customer 30, vehicle 40, 등등)
2. ~~Spring Boot 초기 세팅~~ 완료
3. TableMeta 등록 API (`POST /tables`) — 미착수
4. 조인 규칙 엔진 (Strategy 패턴 실제 구현) — 설계만 됨, 코드 없음
5. 조인 결과 API (`POST /joins`) — 미착수
6. 필터/세그먼트 API (`POST /segments`) — 미착수
7. React 프론트엔드 — 미착수 (React Flow로 관계도 시각화 검토 중이라고만 논의됨)
8. 배포 — 미착수
9. **첫 git 커밋도 아직 안 함**

## 다음 세션에서 먼저 할 일

1. `C:\Projects\TableLink`로 세션 열기 (segmentation 아님!)
2. 첫 git 커밋 진행할지 확인
3. `docker-compose up -d`로 Postgres 띄우고 `mvnw spring-boot:run`으로 백엔드 뜨는지 확인 (아직 검증 안 됨 — JDK는 이번에 막 설치해서 실제 빌드/구동 테스트는 못 해봄)
4. TableMeta 엔티티/API부터 시작 (MVP 순서 3번)
