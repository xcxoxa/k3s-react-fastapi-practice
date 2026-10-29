# K3s React + FastAPI + PostgreSQL(pgvector) + Ollama 실습

2026-10-29 Ubuntu 22.04 서버 두 대로 K3s 경량 Kubernetes 환경을 구축하고 React, FastAPI, PostgreSQL(pgvector), Ollama 연동을 검증한 프로젝트입니다.

## 주요 성과

- K3s Master(React Pod) 및 Worker1(FastAPI Pod) 배포 성공
- Traefik Ingress와 /api 경로용 StripPrefix 연결
- PostgreSQL 단일 DB에서 상품 목록 및 pgvector 벡터 검색
- Ollama `gemma3:270m` 모델로 AI 질의응답
- 브라우저에서 상품 3개, 벡터 검색 3개, AI 답변 확인
- API /health, /products, /vector-search에서 HTTP 200; /ai/ask 응답 정상

## 아키텍처

```text
Browser
  |
  v
Traefik Ingress (K3s)
  |-- /       -> React + Nginx Pod (Master)
  +-- /api/*  -> StripPrefix -> FastAPI Pod (Worker1)
                                       |-- PostgreSQL 14 + pgvector (Worker1 호스트)
                                       +-- Ollama gemma3:270m (Worker1 호스트)
```

**주의:** PostgreSQL과 Ollama는 K3s Pod 내부가 아니라 Worker1 호스트에서 실행됩니다. K3s 이전이 완료된 대상은 React와 FastAPI입니다.

## 기술 스택

React, Vite, Nginx, Python, FastAPI, psycopg2, PostgreSQL 14, pgvector, Ollama, Docker, containerd, K3s, Traefik Ingress, Ubuntu 22.04.

## 주요 API

| API | 기능 | 테스트 |
|---|---|---|
| GET /api/health | 백엔드 상태 | HTTP 200 |
| GET /api/products | 상품 3개 조회 | HTTP 200 |
| GET /api/vector-search | 3차원 샘플 벡터 유사도 검색 | HTTP 200 |
| POST /api/ai/ask | Ollama AI 질의응답 | JSON 답변 확인 |

pgvector 실습에서는 검색 기준 `[1,0,0]`에 대해 사과 0.0000, 배 0.0061, 자동차 1.0000으로 정렬되는 것을 확인했습니다. 이는 샘플 벡터 기반 실습입니다.

## 성능 비교 (각 API 5회)

| 구분 | 상품 조회 평균 | 벡터 검색 평균 |
|---|---:|---:|
| 기존 Nginx 경로 | 13.28ms | 8.23ms |
| K3s 전환 중간 | 7.83ms | 8.00ms |
| React + FastAPI K3s 최종 | 16.49ms | 13.05ms |

최종 측정 시 모든 요청은 HTTP 200이었습니다. DB 구성, 캐시, 요청 경로, 서버 부하가 통제되지 않았고 측정도 5회뿐이므로 K3s 자체의 속도 우열을 입증하는 자료는 아닙니다.

### K3s 최종 자원 사용량

| 노드 | CPU | 메모리 |
|---|---:|---:|
| Master | 38m(1%) | 1536MiB(39%) |
| Worker1 | 19m(표시상 0%) | 1557MiB(40%) |

## 실습 진행 및 시행착오

1. PostgreSQL 14에 pgvector 확장 설치 및 테스트 데이터 생성.
2. 상품 조회를 MySQL에서 PostgreSQL로 변경. 화면의 'MySQL' 제목은 이전 문구가 남아 있어 추후 수정 필요.
3. Ollama 설치, `gemma3:270m` 모델 다운로드 후 응답 확인.
4. Master/Worker1 K3s 클러스터 구성 및 Nginx, Traefik 연결.
5. React Docker 이미지 생성, containerd 등록 및 Pod/Service 배포.
6. React의 HTTP 404 원인을 Ingress /api 라우팅 누락으로 확인하고 StripPrefix 설정.
7. PostgreSQL 전용 `k3s_app` 계정에 조회 권한 부여, DB TCP 접속 및 허용 네트워크 설정.
8. Ollama 네트워크 접속 설정 및 iptables 접근 제한 테스트.
9. FastAPI Docker 이미지, Secret, Deployment, Service 설정 후 Pod 내부 API 4종 검증.
10. Ingress를 호스트 FastAPI에서 K3s FastAPI Service로 변경하고 브라우저에서 전체 기능 확인.

## IP 접속 주소

공개 저장소에는 실제 IP를 노출하지 않습니다. 다음은 **실습 구조를 설명하는 마스킹 주소**입니다.

- 웹 화면: `http://<내-IP>:8080`
- 기존 호스트 FastAPI: `http://<내-IP>:8000`
- DB: `<내-IP>:5432` (접근 제한 필요)
- Ollama: `http://<내-IP>:11434` (접근 제한 필요)

## 클러스터 확인 명령어

```bash
sudo k3s kubectl get nodes -o wide
sudo k3s kubectl get pods -A -o wide
sudo k3s kubectl get svc
sudo k3s kubectl get ingress
sudo k3s kubectl top nodes
```

현재 리소스 이름: `react-practice`, `react-practice-service`, `fastapi-practice`, `fastapi-practice-service`, `backend-api-ingress`, `strip-api`.

## 공개 저장소 보안

DB 비밀번호, `.env`, Kubernetes Secret 값/내보내기 파일, SSH 키, DB 백업, 실제 내부 IP는 GitHub에 업로드하지 않습니다. iptables 규칙 영구화, Kubernetes Secret 보호, 권한 관리, HTTPS 등 운영용 보안 검증은 별도로 필요합니다.

> 이 README는 실습 결과를 문서화한 것입니다. 실제 Ubuntu 서버에 존재하는 React·FastAPI 소스코드 및 K3s YAML 원본은 별도 업로드해야 합니다.
