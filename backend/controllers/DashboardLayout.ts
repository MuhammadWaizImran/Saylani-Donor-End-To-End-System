import { Controller, Injectable, Get, Post, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/dashboard/layout/handler";

@Injectable()
export class DashboardLayoutService {
  get(request: Request) {
    return handlers.GET(request);
  }
  post(request: Request) {
    return handlers.POST(request);
  }
}

@Controller("api/dashboard/layout")
export class DashboardLayoutController {
  constructor(private readonly service: DashboardLayoutService) {}
  @Get()
  get(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.get(request));
  }
  @Post()
  post(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.post(request));
  }
}
