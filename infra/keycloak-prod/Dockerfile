FROM quay.io/keycloak/keycloak:26.8.2

ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_METRICS_ENABLED=true \
    JAVA_OPTS_KC_HEAP="-XX:InitialRAMPercentage=25 -XX:MaxRAMPercentage=45"

COPY infra/keycloak-prod/mefit-realm.json /opt/keycloak/data/import/mefit-realm.json

RUN /opt/keycloak/bin/kc.sh build --db=postgres

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
# The realm is provisioned once into persistent Postgres; importing it on every
# restart delays readiness and adds memory pressure on the small trial instance.
CMD ["start", "--optimized"]
