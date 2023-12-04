# controller-login

Somewhere between a `mock-login` and an `acmidm-login`.

If you need to expose mock login capabilities while still making sure the authenticated user has some kind of admin role
to do such operation.

### Usage:

```yml
controle-login:
  image: lblod/acmidm-login-service:0.9.2
  environment:
    MU_APPLICATION_AUTH_REDIRECT_URI: "https://controle.organisaties.lokaalbestuur.lblod.info/controller-login"
    MU_APPLICATION_AUTH_DISCOVERY_URL: "https://authenticatie-ti.vlaanderen.be/op"
    MU_APPLICATION_AUTH_CLIENT_ID: "client_id"
    MU_APPLICATION_AUTH_ROLE_CLAIM: "abb_orgcontactgegevens_rol_1d"
    MU_APPLICATION_AUTH_CLIENT_SECRET: "secret"
    DEBUG_LOG_TOKENSETS: "yes"
  links:
    - db:database
controle-login-proxied:
  image: lblod/controller-login
  environment:
    ACM_IDM_LOGIN_ENDPOINT: "http://controle-login"
  links:
    - db:database
```
