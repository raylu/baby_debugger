#!/usr/bin/env python3

from __future__ import annotations

import datetime
import hashlib
import hmac
import json
import mimetypes
from os import path
import struct
import sys
import time
import typing

from pigwig import PigWig, Response
from pigwig.exceptions import HTTPException
import webauthn
import webauthn.helpers.exceptions

import config
import db

if typing.TYPE_CHECKING:
	from pigwig import Request
	from pigwig.routes import RouteDefinition

def root(request: Request, catchall: str | None=None) -> Response:
	return Response.render(request, 'index.jinja2', {})

def register_challenge(request: Request) -> Response:
	host = _rp_id(request)
	username: str = request.body['username']
	if host not in ['babydebugger.app', 'localhost'] or len(username) < 2:
		return Response(code=400)

	reg_opts = webauthn.generate_registration_options(rp_id=host, rp_name='baby debugger',
			user_name=username, challenge=_make_challenge(username))
	return Response(webauthn.options_to_json(reg_opts), content_type='application/json')

def register_attest(request: Request) -> Response:
	username: str = request.body['username']
	credential: dict = request.body['credential']
	challenge = _verify_challenge(username, credential)

	try:
		registration = webauthn.verify_registration_response(credential=credential,
			expected_challenge=challenge, expected_rp_id=_rp_id(request),
			expected_origin=['https://babydebugger.app', 'http://localhost:8000'])
		db.User.create(username=username, public_key=registration.credential_public_key)
	except webauthn.helpers.exceptions.InvalidRegistrationResponse:
		return Response(code=403)
	return Response.json(True)

def login_challenge(request: Request) -> Response:
	username: str = request.body['username']
	authn_opts = webauthn.generate_authentication_options(rp_id=_rp_id(request), challenge=_make_challenge(username))
	return Response(webauthn.options_to_json(authn_opts), content_type='application/json')

def login_assert(request: Request) -> Response:
	username: str = request.body['username']
	user = db.User.get_or_none(username=username)
	if user is None:
		return Response(code=403)

	assertion: dict = request.body['assertion']
	challenge = _verify_challenge(username, assertion)
	try:
		webauthn.verify_authentication_response(credential=assertion, expected_challenge=challenge,
				credential_public_key=user.public_key, credential_current_sign_count=0,
				expected_rp_id=_rp_id(request), expected_origin=['https://babydebugger.app', 'http://localhost:8000'])
	except webauthn.helpers.exceptions.InvalidAuthenticationResponse:
		return Response(code=403)

	response = Response.json(True)
	response.set_secure_cookie(request, 'user_id', user.id, max_age=datetime.timedelta(days=30), http_only=True)
	response.set_cookie('username', user.username, max_age=datetime.timedelta(days=30))
	return response

def _make_challenge(username: str) -> bytes:
	challenge = struct.pack('Q', int(time.time())) + username.encode('utf-8')[:24]
	return _sign(challenge) + challenge

def _verify_challenge(username: str, credential: dict) -> bytes:
	client_data = json.loads(webauthn.base64url_to_bytes(credential['response']['clientDataJSON']))
	challenge = webauthn.base64url_to_bytes(client_data['challenge'])
	(ts,) = struct.unpack('Q', challenge[32:40])
	if ts + 300 < time.time():
		raise HTTPException(403, 'challenge expired')
	if username.encode('utf-8')[:24] != challenge[40:]:
		raise HTTPException(403, 'username does not match challenge')
	if not hmac.compare_digest(challenge[:32], _sign(challenge[32:])):
		raise HTTPException(403, 'invalid challenge signature')
	return challenge

def _sign(msg: bytes) -> bytes:
	return hashlib.blake2b(msg, key=config.webauthn_challenge_secret, digest_size=32).digest()

def _rp_id(request: Request) -> str:
	host = request.headers['Host']
	if ':' in host:
		host = host.split(':', 1)[0]
	return host

def logout(request: Request) -> Response:
	response = Response.json(True)
	response.set_cookie('user_id', '', expires=datetime.datetime.min)
	response.set_cookie('username', '', expires=datetime.datetime.min)
	return response

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
	return Response(body=content, content_type=content_type)

routes: RouteDefinition = [
	('GET', '/', root),
	('GET', '/<path:catchall>', root),
	('POST', '/api/register/challenge', register_challenge),
	('POST', '/api/register/attest', register_attest),
	('POST', '/api/login/challenge', login_challenge),
	('POST', '/api/login/assert', login_assert),
	('POST', '/api/logout', logout),
	('GET', '/api/babies', get_babies),
	('GET', '/api/baby/<baby_id>/day/<day>', get_day),
	('POST', '/api/baby/<baby_id>/day/<day>/nap/<nap_number>', update_nap),
	('GET', '/service_worker.js', service_worker),
	('GET', '/static/<path:file_path>', static),
]

def response_done_handler(request, response) -> None:
	db.db.close()

app = PigWig(routes, template_dir='templates', cookie_secret=config.cookie_secret,
		response_done_handler=response_done_handler)

if __name__ == '__main__':
	mimetypes.add_type('application/json', '.map')
	port = 8000
	if len(sys.argv) == 2: # production
		import fastwsgi
		port = int(sys.argv[1])
		fastwsgi.run(app, '127.1', port)
	else: # dev
		app.main()
