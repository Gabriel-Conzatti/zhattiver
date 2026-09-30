import os

os.environ.setdefault("LYNK_ENV", "testing")
# TEST_DATABASE_URL deve apontar para um PostgreSQL real; testes de banco são marcados
# como `integration` e podem ser pulados quando a env não está disponível.
