#!/usr/bin/env python3

from __future__ import annotations

import mimetypes
from os import path
import sys
import typing

from pigwig import PigWig, Response

if typing.TYPE_CHECKING:
	from pigwig import Request

def root(request: Request) -> Response:
	return Response.render(request, 'index.jinja2', {})

def baby_day(request: Request, baby_id, date) -> Response:
	return Response.render(request, 'baby_day.jinja2', {})

def static(request, file_path: str) -> Response:
	try:
		with open(path.join('static', file_path), 'rb') as f:
			content = f.read()
	except FileNotFoundError:
		return Response('not found', 404)
	content_type, _ = mimetypes.guess_type(file_path)
	assert content_type is not None
	return Response(body=content, content_type=content_type)

routes = [
	('GET', '/', root),
	('GET', '/baby/<baby_id>/day/<date>', baby_day),
	('GET', '/static/<path:file_path>', static),
]

app = PigWig(routes, template_dir='templates')

if __name__ == '__main__':
	port = 8000
	if len(sys.argv) == 2: # production
		import fastwsgi
		port = int(sys.argv[1])
		fastwsgi.run(app, '127.1', port)
	else: # dev
		app.main()
