```
$ docker run --name baby_dbg_db -p 5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=babydbg postgres
$ uv pip install -r requirements.txt
$ python3 db.py
$ ./baby_dbg.py
```
