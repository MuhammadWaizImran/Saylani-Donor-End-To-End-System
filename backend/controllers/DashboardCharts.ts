import { Controller, Injectable, Get, Post, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/dashboard/charts/handler";

@Injectable()
export class DashboardChartsService {
  get(request: Request) {
    return handlers.GET(request);
  }
  post(request: Request) {
    return handlers.POST(request);
  }
}

@Controller("api/dashboard/charts")
export class DashboardChartsController {
  constructor(private readonly service: DashboardChartsService) {}
  @Get()
  get(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.get(request));
  }
  @Post()
  post(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.post(request));
  }
}
