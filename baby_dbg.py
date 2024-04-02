#!/usr/bin/env python3

from __future__ import annotations

import mimetypes
from os import path
import sys
import typing

import peewee
from pigwig import PigWig, Response
import webauthn
import webauthn.helpers.exceptions

import db

if typing.TYPE_CHECKING:
	from pigwig import Request
	from pigwig.routes import RouteDefinition

def root(request: Request, catchall: str | None=None) -> Response:
	return Response.render(request, 'index.jinja2', {})

def register_challenge(request: Request) -> Response:
	host = request.headers['Host']
	if ':' in host:
		host = host.split(':', 1)[0]
	username = request.body['username']
	if host not in ['babydebugger.app', 'localhost'] or len(username) < 2:
		return Response(code=400)
	reg_opts = webauthn.generate_registration_options(rp_id=host, rp_name='baby debugger', user_name=username)

	five_minutes = peewee.SQL("INTERVAL '5 minutes'")
	db.WebAuthnChallenge.delete().where(db.WebAuthnChallenge.created < peewee.fn.NOW() - five_minutes).execute()
	db.WebAuthnChallenge(id=reg_opts.user.id, challenge=reg_opts.challenge).save()
	return Response(webauthn.options_to_json(reg_opts), content_type='application/json')

def register_attest(request: Request) -> Response:
	credential = request.body['credential']
	challenge = db.WebAuthnChallenge.get_by_id(credential['id'])

	host = request.headers['Host']
	if ':' in host:
		host = host.split(':', 1)[0]
	try:
		registration = webauthn.verify_registration_response(credential=credential,
			expected_challenge=challenge.challenge, expected_rp_id=host,
			expected_origin=['https://babydebugger.app', 'http://localhost:8000'])
	except webauthn.helpers.exceptions.InvalidRegistrationResponse:
		return Response(code=403)
	print(registration)
	return Response.json(True)

def get_babies(request: Request) -> Response:
	babies = db.Baby.select()
	return Response.json([{'id': baby.id, 'name': baby.name} for baby in babies])

def get_day(request: Request, baby_id: str, day: str) -> Response:
	try:
		baby_day: db.BabyDay = db.BabyDay.select() \
				.where(db.BabyDay.baby_id==int(baby_id), db.BabyDay.date==day).join(db.Baby).get() # pyright: ignore[reportAttributeAccessIssue]
	except db.BabyDay.DoesNotExist: # pyright: ignore[reportAttributeAccessIssue]
		return Response(code=404)
	naps = db.Nap.select().where(db.Nap.baby_day==baby_day).order_by(db.Nap.number)
	return Response.json({
		'baby': {'name': baby_day.baby.name},
		'day': str(baby_day.date),
		'naps': {nap.number: {
			'wake_up_time': nap.wake_up_time.strftime('%H:%M'),
			'awake_window': nap.awake_window, 'calm_down_time': nap.calm_down_time,
		} for nap in naps},
	})

def update_nap(request: Request, baby_id: str, day: str, nap_number: str) -> Response:
	with db.db.atomic():
		baby_day, _ = db.BabyDay.get_or_create(baby_id=int(baby_id), date=day)
		db.Nap.insert(baby_day=baby_day, number=int(nap_number), wake_up_time=request.body['wake_up_time'],
				awake_window=request.body['awake_window'], calm_down_time=request.body['calm_down_time']) \
				.on_conflict(conflict_target=[db.Nap.baby_day, db.Nap.number],
						preserve=[db.Nap.wake_up_time, db.Nap.awake_window, db.Nap.calm_down_time]).execute()
	return Response.json(True)

def service_worker(request: Request) -> Response:
	with open(path.join('static', 'service_worker.js'), 'rb') as f:
		return Response(body=f.read(), content_type='application/javascript')

def static(request, file_path: str) -> Response:
	try:
		with open(path.join('static', file_path), 'rb') as f:
			content = f.read()
	except FileNotFoundError:
		return Response('not found', 404)
	content_type, _ = mimetypes.guess_type(file_path)
	assert content_type is not None
	headers: list[tuple[str, str]] | None = None
	if file_path.endswith('.js') and path.isfile(path.join('static', file_path + '.map')):
		headers = [('SourceMap', path.join('/static', file_path + '.map'))]
	return Response(body=content, content_type=content_type, extra_headers=headers)

routes: RouteDefinition = [
	('GET', '/', root),
	('GET', '/<path:catchall>', root),
	('POST', '/api/register/challenge', register_challenge),
	('POST', '/api/register/attest', register_attest),
	('GET', '/api/babies', get_babies),
	('GET', '/api/baby/<baby_id>/day/<day>', get_day),
	('POST', '/api/baby/<baby_id>/day/<day>/nap/<nap_number>', update_nap),
	('GET', '/service_worker.js', service_worker),
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
