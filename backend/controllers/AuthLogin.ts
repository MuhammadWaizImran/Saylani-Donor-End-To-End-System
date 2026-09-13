import { Controller, Injectable, Post, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/auth/login/handler";

@Injectable()
export class AuthLoginService {
  post(request: Request) {
    return handlers.POST(request);
  }
}

@Controller("api/auth/login")
export class AuthLoginController {
  constructor(private readonly service: AuthLoginService) {}
  @Post()
  post(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.post(request));
  }
}
