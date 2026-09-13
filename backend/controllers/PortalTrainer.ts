import { Controller, Injectable, Get, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/portal/trainer/handler";

@Injectable()
export class PortalTrainerService {
  get(request: Request) {
    return handlers.GET(request);
  }
}

@Controller("api/portal/trainer")
export class PortalTrainerController {
  constructor(private readonly service: PortalTrainerService) {}
  @Get()
  get(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.get(request));
  }
}
