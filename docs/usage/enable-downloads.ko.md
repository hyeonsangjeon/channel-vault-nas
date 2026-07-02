# 실제 다운로드 켜기

Channel Vault NAS는 **기본적으로 안전**합니다. 미디어 전송을 시작하지 않고도
작업을 계획하고 큐에 넣을 수 있습니다. 실제 다운로드에는 워커 플래그가 필요하며,
이는 의도적이고 명시적인 단계입니다.

## 워커 켜기

다음 런타임 env 값을 설정하세요:

```bash
CVN_DOWNLOAD_WORKER_ENABLED=true
CVN_YTDLP_BINARY=yt-dlp
CVN_FFPROBE_BINARY=ffprobe
```

그런 다음 **백엔드를 재시작**하세요. **Settings** 탭은 비밀이 아닌 런타임
오버라이드를 `.env.runtime`에 저장하고, 재시작이 아직 필요한지 보여줍니다.

=== "Docker / Compose"

    `.env`(또는 `.env.runtime`)에 값을 추가하고 `api` 서비스를 재시작하세요:

    ```bash
    docker compose restart api
    ```

=== "로컬 개발"

    플래그를 export하고 uvicorn을 재시작하세요:

    ```bash
    CVN_DOWNLOAD_WORKER_ENABLED=true \
    CVN_DB_MIGRATE_ON_STARTUP=true \
    uvicorn app.main:app --host 127.0.0.1 --port 8000
    ```

!!! tip "UI에서 하기"
    **Settings → Runtime env manifest**를 여세요. NAS를 무장시키는 정확한 env
    줄, **Copy manifest** 버튼, 그리고 재시작 어댑터가 구성돼 있으면 **Request
    restart** 작업을 보여줍니다. [설정 둘러보기](product-tour.md#settings) 참고.

## 패스는 항상 제한됩니다

워커 패스는 실수로 클릭해도 NAS나 네트워크를 포화시키지 못하도록 의도적으로
제한됩니다:

- UI 실행 버튼은 기본적으로 **확인 모달**을 띄웁니다
  ([첫 백업 → 4단계](first-backup.md#step-4-confirm-the-guarded-pass) 참고).
- API `run-once` 한도가 제한됩니다.
- 단일 가드형 패스는 **최대 5개 작업**을 실행합니다.
- 채널별 정책으로 워커 claim을 **일시정지**할 수 있습니다.
- 워커가 일시정지돼 있어도 후보 생성은 **계속**될 수 있습니다.

<figure markdown="span">
  ![다운로드 확인 모달](../assets/user-manual/ko/04-download-confirm-modal.png){ loading=lazy }
  <figcaption>확인 모달은 실제 전송의 관문입니다 — “Start up to 5”는 워커가 켜져 있을 때만 실행됩니다.</figcaption>
</figure>

!!! warning "노출 전에 검증하세요"
    다운로드를 켜는 것이 NAS를 노출하지는 않습니다. 원시 API는 loopback에 묶어
    두고, [액세스 토큰](../install/access-token.md)을 설정하고, 신뢰할 수 있는
    리버스 프록시나 VPN을 통해 웹 계층만 공개하세요.
