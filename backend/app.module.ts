import { Module, Controller, Get } from "@nestjs/common";
import { AdminRecordsController, AdminRecordsService } from "./controllers/AdminRecords";
import { AuthLoginController, AuthLoginService } from "./controllers/AuthLogin";
import { AuthLogoutController, AuthLogoutService } from "./controllers/AuthLogout";
import { AuthSessionController, AuthSessionService } from "./controllers/AuthSession";
import { AuthSignupController, AuthSignupService } from "./controllers/AuthSignup";
import { ChatController, ChatService } from "./controllers/Chat";
import { ChatConversationsController, ChatConversationsService } from "./controllers/ChatConversations";
import { ChatConversationsIdController, ChatConversationsIdService } from "./controllers/ChatConversationsId";
import { DashboardChartsController, DashboardChartsService } from "./controllers/DashboardCharts";
import { DashboardLayoutController, DashboardLayoutService } from "./controllers/DashboardLayout";
import { PortalTrainerController, PortalTrainerService } from "./controllers/PortalTrainer";
import { ReportsSponsorshipController, ReportsSponsorshipService } from "./controllers/ReportsSponsorship";
import { ReportsIdController, ReportsIdService } from "./controllers/ReportsId";
import { VoiceTtsController, VoiceTtsService } from "./controllers/VoiceTts";

@Module({ controllers: [AdminRecordsController], providers: [AdminRecordsService] })
class AdminModule {}

@Module({ controllers: [AuthLoginController, AuthLogoutController, AuthSessionController, AuthSignupController], providers: [AuthLoginService, AuthLogoutService, AuthSessionService, AuthSignupService] })
class AuthModule {}

@Module({ controllers: [ChatController, ChatConversationsController, ChatConversationsIdController], providers: [ChatService, ChatConversationsService, ChatConversationsIdService] })
class ChatModule {}

@Module({ controllers: [DashboardChartsController, DashboardLayoutController], providers: [DashboardChartsService, DashboardLayoutService] })
class DashboardModule {}

@Module({ controllers: [PortalTrainerController], providers: [PortalTrainerService] })
class PortalModule {}

@Module({ controllers: [ReportsSponsorshipController, ReportsIdController], providers: [ReportsSponsorshipService, ReportsIdService] })
class ReportsModule {}

@Module({ controllers: [VoiceTtsController], providers: [VoiceTtsService] })
class VoiceModule {}

@Controller("api/health")
class HealthController {
  @Get()
  health() { return { status: "ok", backend: "nestjs" }; }
}

@Module({ imports: [AdminModule, AuthModule, ChatModule, DashboardModule, PortalModule, ReportsModule, VoiceModule], controllers: [HealthController] })
export class AppModule {}
