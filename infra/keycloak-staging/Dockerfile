FROM quay.io/keycloak/keycloak:26.8.2 AS builder

ENV KC_DB=postgres \
    KC_CACHE=local \
    KC_HEALTH_ENABLED=false \
    KC_METRICS_ENABLED=false

RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.8.2 AS runtime

COPY --from=builder --chown=1000:0 /opt/keycloak/ /opt/keycloak/
COPY --chown=1000:0 infra/keycloak-staging/mefit-realm.json.template /opt/keycloak/data/import/mefit-realm.json.template
COPY --chown=1000:0 infra/keycloak-staging/entrypoint.sh /opt/keycloak/bin/mefit-entrypoint.sh
RUN chmod 0755 /opt/keycloak/bin/mefit-entrypoint.sh

ENV KC_DB=postgres \
    KC_CACHE=local \
    KC_HEALTH_ENABLED=false \
    KC_METRICS_ENABLED=false \
    KC_HOSTNAME_STRICT=false \
    KC_HTTP_ENABLED=true \
    KC_HTTP_PORT=10000 \
    KC_PROXY_HEADERS=xforwarded \
    KC_DB_POOL_MAX_SIZE=5 \
    KC_DB_POOL_INITIAL_SIZE=2 \
    JAVA_OPTS_KC_HEAP="-Xms64m -Xmx300m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC -Xss512k -XX:ReservedCodeCacheSize=64m"

EXPOSE 10000

ENTRYPOINT ["/opt/keycloak/bin/mefit-entrypoint.sh"]
CMD ["start", "--optimized", "--import-realm"]
