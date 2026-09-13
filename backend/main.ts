import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { raw } from "express";
import { AppModule } from "./app.module";

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  app.use(raw({ type: () => true, limit: "2mb" }));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 4000), "0.0.0.0");
  return app;
}
void bootstrap();
