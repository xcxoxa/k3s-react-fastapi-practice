# 소스 코드 배포 안내

기존 README는 2026-10-29 실습 기록으로 그대로 보존했습니다. 이 문서는 추가된 공개용 소스의 재배포 절차입니다. 기존 README의 “소스 별도 업로드”는 업로드 전 기록입니다. React 화면에 남은 MySQL 문구와 달리 현재 상품 조회는 PostgreSQL을 사용합니다.

## 구성과 사전 조건

- React와 FastAPI만 K3s Pod로 실행합니다. PostgreSQL 14 + pgvector와 Ollama는 Worker 호스트에서 실행합니다.
- 기존 DB와 데이터는 그대로 사용합니다. 초기화·삭제 명령은 없습니다.
- `kubectl get nodes`로 실제 노드 이름을 확인하고 두 Deployment의 nodeSelector를 맞춥니다. 예시는 `k8s-master`, `k8s-worker1`입니다.
- Traefik 및 `traefik.io/v1alpha1` Middleware CRD가 필요합니다. `kubectl get crd middlewares.traefik.io`로 확인합니다. 구형 Traefik은 설치된 CRD에 맞게 apiVersion을 조정합니다.
- `default` namespace 기준입니다. 다른 namespace에서는 Middleware annotation도 변경해야 합니다.

## 환경변수

`fastapi-db-secret`에 DB_USER, DB_PASSWORD, DB_HOST, OLLAMA_URL을 설정해야 합니다. DB_NAME 기본값은 practice_vector_db, DB_PORT는 5432, OLLAMA_MODEL은 gemma3:270m입니다.

DB_HOST에는 **Pod에서 접근 가능한 Worker 호스트 주소**를 넣습니다. OLLAMA_URL에는 같은 호스트의 `http://주소:11434`를 넣습니다. `ollama.internal`은 사용하지 않습니다. localhost는 Pod 자신이므로 호스트 DB·Ollama 주소로 사용할 수 없습니다.

다음 명령은 Bash에서 실제 값을 직접 입력받으며 비밀번호를 명령 이력이나 YAML 파일에 기록하지 않습니다. 기존 Secret을 변경하면 실행 환경에 영향을 줄 수 있으므로 재배포 시에만 실행합니다.

```bash
read -r -p 'DB host: ' DB_HOST
read -r -p 'DB user: ' DB_USER
read -r -s -p 'DB password: ' DB_PASSWORD
printf '\n'
read -r -p 'Ollama base URL: ' OLLAMA_URL
kubectl -n default create secret generic fastapi-db-secret \
  --from-literal=DB_HOST="$DB_HOST" \
  --from-literal=DB_USER="$DB_USER" \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=OLLAMA_URL="$OLLAMA_URL" \
  --dry-run=client -o yaml | kubectl apply -f -
unset DB_PASSWORD
```

PostgreSQL은 Pod 네트워크에서 접속 가능해야 하며 pg_hba.conf와 방화벽에서 필요한 범위만 허용합니다. DB 계정에는 products(id, name, price), practice_vectors(name, embedding) 조회 권한과 vector 확장이 필요합니다. 검색 벡터는 3차원 [1,0,0]입니다. Ollama에는 gemma3:270m 모델과 Pod 접근 설정이 필요합니다. 기존 DB 데이터나 운영 설정은 자동 생성·변경하지 않습니다.

## 이미지 빌드 및 등록

저장소 루트에서 Docker가 설치된 장비로 빌드합니다. 프론트 Dockerfile이 npm ci와 Vite 빌드를 수행합니다.

```bash
docker build -t react-practice:v1 frontend
docker build -f backend/Dockerfile.k3s -t fastapi-practice:k3s-v1 backend
docker save react-practice:v1 -o /tmp/react-practice.tar
docker save fastapi-practice:k3s-v1 -o /tmp/fastapi-practice.tar
```

React tar는 Master, FastAPI tar는 Worker에 전송한 뒤 각각 해당 노드에서 실행합니다.

```bash
sudo k3s ctr images import /tmp/react-practice.tar
```

```bash
sudo k3s ctr images import /tmp/fastapi-practice.tar
```

imagePullPolicy가 Never이므로 Pod가 배치될 노드에 정확한 태그의 이미지가 있어야 합니다. 기존 태그를 덮어쓸 때는 새 버전 태그로 Deployment도 함께 수정하는 것을 권장합니다.

## 재배포 및 확인

기존 Ingress가 같은 경로를 처리하는지 먼저 확인하고 중복 라우트를 정리한 후 적용합니다. 배포 적용은 실행 중인 Pod를 교체할 수 있습니다. 이번 GitHub 업로드 작업에서는 서버에 적용하지 않았습니다.

```bash
kubectl -n default get ingress
kubectl -n default apply -f k8s/
kubectl -n default rollout status deployment/react-practice
kubectl -n default rollout status deployment/fastapi-practice
kubectl -n default get pods,svc,ingress
```

## IP 접속 주소

- 기존 실습 웹 화면: `http://<내-IP>:8080`
- Ingress 경로: `/api/health`, `/api/products`, `/api/vector-search`, `/api/ai/ask`
- 8080은 기존 실습 호스트의 포트 전달 설정입니다. 이 YAML만 적용해서 8080 포트가 생성되지는 않습니다. 새 클러스터에서는 Traefik의 실제 진입 포트를 확인합니다.
- 기존 전달 설정이 없다면 테스트용으로 `kubectl -n kube-system port-forward service/traefik 8080:80`을 실행하고 해당 장비에서 `http://localhost:8080`으로 확인할 수 있습니다.

## 이번 검증 범위

소스 정적 검사와 가능한 로컬 빌드를 수행했습니다. 실제 서버에 접근할 수 없어 클러스터 배포, DB 쿼리, 실제 Ollama 호출은 재검증하지 않았습니다. 의존성 버전은 첨부 원본을 보존했으며 설치 결과는 최종 작업 보고를 확인해 주세요.
