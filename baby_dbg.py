#!/usr/bin/env python3

from __future__ import annotations

import mimetypes
from os import path
import sys
import typing

from pigwig import PigWig, Response

import db

if typing.TYPE_CHECKING:
	from pigwig import Request

def root(request: Request, catchall: str | None=None) -> Response:
	return Response.render(request, 'index.jinja2', {})

def get_day(request: Request, baby_id: str, day: str) -> Response:
	baby_day: db.BabyDay = db.BabyDay.select() \
			.where(db.BabyDay.baby_id==int(baby_id), db.BabyDay.date==day).join(db.Baby).get() # pyright: ignore[reportAttributeAccessIssue]
	naps = db.Nap.select().where(db.Nap.baby_day==baby_day).order_by(db.Nap.number)
	return Response.json({
		'baby': {'name': baby_day.baby.name},
		'day': str(baby_day.date),
		'naps': [{
			'number': nap.number, 'wake_up_time': nap.wake_up_time.strftime('%H:%M'),
			'awake_window': nap.awake_window, 'calm_down_time': nap.calm_down_time} for nap in naps],
	})

def update_nap(request: Request, baby_id: str, day: str, nap_number: str) -> Response:
	with db.db.atomic():
		baby_day, _ = db.BabyDay.get_or_create(baby_id=int(baby_id), date=day)
		db.Nap.insert(baby_day=baby_day, number=int(nap_number), wake_up_time=request.body['wake_up_time'],
				awake_window=request.body['awake_window'], calm_down_time=request.body['calm_down_time']) \
				.on_conflict(conflict_target=[db.Nap.baby_day, db.Nap.number],
						preserve=[db.Nap.wake_up_time, db.Nap.awake_window, db.Nap.calm_down_time]).execute()
	return Response.json(True)

def static(request, file_path: str) -> Response:
	try:
		with open(path.join('static', file_path), 'rb') as f:
			content = f.read()
	except FileNotFoundError:
		return Response('not found', 404)
	content_type, _ = mimetypes.guess_type(file_path)
	assert content_type is not None
	headers = None
	if file_path.endswith('.js') and path.isfile(path.join('static', file_path + '.map')):
		headers = [('SourceMap', path.join('/static', file_path + '.map'))]
	return Response(body=content, content_type=content_type, extra_headers=headers)

routes = [
	('GET', '/', root),
	('GET', '/<path:catchall>', root),
	('GET', '/api/baby/<baby_id>/day/<day>', get_day),
	('POST', '/api/baby/<baby_id>/day/<day>/nap/<nap_number>', update_nap),
	('GET', '/static/<path:file_path>', static),
]

def response_done_handler(request, response) -> None:
	db.db.close()

app = PigWig(routes, template_dir='templates', response_done_handler=response_done_handler)

if __name__ == '__main__':
	mimetypes.add_type('application/json', '.map')
	port = 8000
	if len(sys.argv) == 2: # production
		import fastwsgi
		port = int(sys.argv[1])
		fastwsgi.run(app, '127.1', port)
	else: # dev
		app.main()
