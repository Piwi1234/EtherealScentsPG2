import { PartialType } from "@nestjs/swagger";
import { CreateRedSocialDto } from "./create-red-social.dto";

export class UpdateRedSocialDto extends PartialType(CreateRedSocialDto) {}
