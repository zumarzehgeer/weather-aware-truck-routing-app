import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'local-development-only-do-not-deploy')
if os.environ.get('DJANGO_REQUIRE_SECRET', 'false').lower() == 'true' and (len(SECRET_KEY) < 40 or SECRET_KEY.startswith(('local-', 'replace-'))):
    raise ImproperlyConfigured('Set DJANGO_SECRET_KEY to a random value of at least 40 characters in deployment settings.')
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
if os.environ.get('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(os.environ['RENDER_EXTERNAL_HOSTNAME'])
INSTALLED_APPS = ['django.contrib.staticfiles', 'routing']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware', 'django.middleware.gzip.GZipMiddleware',
              'django.middleware.common.CommonMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
USE_TZ = True
TIME_ZONE = 'UTC'
STATIC_URL = '/assets/'
STATIC_ROOT = BASE_DIR.parent / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR.parent / 'frontend/dist/assets'] if (BASE_DIR.parent / 'frontend/dist/assets').exists() else []
STORAGES = {'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'}}
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'weather-routing',
                      'OPTIONS': {'MAX_ENTRIES': 2000}}}
DATA_UPLOAD_MAX_MEMORY_SIZE = 16384
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'
SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'false').lower() == 'true'
if os.environ.get('TRUST_PROXY', 'false').lower() == 'true':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
ENABLE_DEMO = os.environ.get('ENABLE_DEMO', 'true').lower() == 'true'
OSRM_BASE_URL = os.environ.get('OSRM_BASE_URL', 'https://router.project-osrm.org')
WEATHER_BASE_URL = os.environ.get('WEATHER_BASE_URL', 'https://api.open-meteo.com')
GEOCODING_BASE_URL = os.environ.get('GEOCODING_BASE_URL', 'https://geocoding-api.open-meteo.com')
PROVIDER_USER_AGENT = os.environ.get('PROVIDER_USER_AGENT', 'WeatherAwareAssessment/1.0')
