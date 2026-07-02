# 선택적 액세스 토큰

LAN / NAS 데모에서는 스택을 시작하기 전에 운영자 토큰을 설정하세요. 활성화하면
`/api/health`를 제외한 모든 API 라우트가 토큰을 요구합니다.

## 토큰 설정

`.env`(또는 `.env.runtime`)에 추가하세요:

```env
CVN_AUTH_TOKEN=replace-with-a-long-random-token
```

강력한 값을 생성하려면:

```bash
openssl rand -base64 36
```

## 앱 안에서 생성

앱을 벗어나지 않고 토큰을 만들고, 복사하고, 검증할 수 있습니다.
**Settings → Env guide → Public access guard**를 여세요. 이 기능은:

- **브라우저 안에서** 강력한 토큰을 생성하고,
- `.env.runtime`용 `CVN_AUTH_TOKEN=...` 줄을 복사하고,
- `401`/`200` 스모크 테스트 명령을 복사합니다.

토큰은 로컬에서 생성되며 백엔드로 전송되거나, 로깅되거나, 지원 번들에 포함되지
않습니다.

## 클라이언트가 보내는 방법

활성화하면 UI에 액세스 게이트가 표시되고 토큰은 현재 브라우저에만 저장됩니다. API
클라이언트는 두 헤더 중 하나를 보낼 수 있습니다:

```bash
curl -H "Authorization: Bearer $CVN_AUTH_TOKEN" http://127.0.0.1:8000/api/dashboard
```

또는:

```bash
curl -H "X-CVN-Token: $CVN_AUTH_TOKEN" http://127.0.0.1:8000/api/dashboard
```

!!! warning "이것은 로컬 가드레일이지 인터넷 인증이 아닙니다"
    이 토큰은 운영자 가드레일입니다. 사설 네트워크 밖의 무언가를 위해서는 VPN,
    신뢰할 수 있는 리버스 프록시, 네트워크 수준 접근 제어를 추가하세요. 사설
    LAN이나 터널 접근용 배포 예시는
    [`docs/deployment-security.md`](https://github.com/hyeonsangjeon/channel-vault-nas/blob/main/docs/deployment-security.md)에
    있습니다.
