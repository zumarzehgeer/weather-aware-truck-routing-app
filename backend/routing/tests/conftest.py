"""Isolate in-memory provider caches and quota budgets between tests."""

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
