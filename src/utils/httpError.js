import { StatusCodes } from 'http-status-codes'

export class HttpError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request') {
    super(message, StatusCodes.BAD_REQUEST)
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(message, StatusCodes.UNAUTHORIZED)
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(message, StatusCodes.FORBIDDEN)
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found') {
    super(message, StatusCodes.NOT_FOUND)
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error') {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR)
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(message, StatusCodes.CONFLICT)
  }
}
