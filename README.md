# Osaka Risk App

�h�Ѓ��X�N�����A�v���B�n�}�\���E�n�`����E�Ŋ��������E���X�N�J�[�h�\���𓝍��B

## �Z�b�g�A�b�v
### Backend (FastAPI)
python -m venv venv
venv\Scripts\activate
pip install -r backend/requirements.txt

### Frontend
# �ÓIHTML/JS�i�J�����j�B�C�ӂ̃��[�J���T�[�o�Ŕz�M or ���ڊJ��

## .env�i��� .env.example ���Q�Ɓj
- DATABASE_URL: �� `sqlite:///./data/app.db`
- SECRET_KEY: JWT�p�̔閧��
- ALGORITHM: �� `HS256`
- ACCESS_TOKEN_EXPIRE_MINUTES: �� `60`
- VITE_API_BASE: �� `http://127.0.0.1:8000`

## �N����
# Backend
uvicorn app_API:app --app-dir backend --reload

# Frontend
# front/html/test3.html ���u���E�U�ŊJ�� �Ȃ�
