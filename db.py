import pathlib

from peewee import BlobField, CharField, CompositeKey, DateField, ForeignKeyField, Model, SmallIntegerField, TimeField
import playhouse.pool

_pool_args = {'database': 'babydbg', 'user': 'babydbg', 'stale_timeout': 300}
if not pathlib.Path('/var/run/postgresql').is_dir():
	_pool_args['host'] = '127.1'
db = playhouse.pool.PooledPostgresqlExtDatabase(**_pool_args)

class BaseModel(Model):
	class Meta:
		database = db

class User(BaseModel):
	username = CharField()
	public_key = BlobField()

class Baby(BaseModel):
	name = CharField()

class BabyDay(BaseModel):
	baby = ForeignKeyField(Baby)
	date = DateField()

	class Meta: # pyright: ignore reportIncompatibleVariableOverride
		indexes = (
			(('baby', 'date'), True),
		)

class Nap(BaseModel):
	baby_day = ForeignKeyField(BabyDay)
	number = SmallIntegerField()
	wake_up_time = TimeField()
	awake_window = SmallIntegerField()
	calm_down_time = SmallIntegerField()

	class Meta: # pyright: ignore reportIncompatibleVariableOverride
		primary_key = CompositeKey('baby_day', 'number')

if __name__ == '__main__':
	if Baby.table_exists():
		print('baby table already exists')
	else:
		print('creating tables', ', '.join(c.__name__ for c in BaseModel.__subclasses__()))
		db.create_tables(BaseModel.__subclasses__(), safe=False)
		Baby(name='randy').save()
