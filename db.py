from peewee import CharField, Model, PostgresqlDatabase

db = PostgresqlDatabase('babydbg', host='127.1', user='babydbg')

class BaseModel(Model):
    class Meta:
        database = db

class Baby(BaseModel):
    name = CharField()

if __name__ == '__main__':
    print('creating tables...')
    db.create_tables([Baby])
