import { Module } from "@nestjs/common";
import { CarouselImageService } from "./carousel-image.service";

@Module({
  providers: [CarouselImageService],
  exports: [CarouselImageService],
})
export class CarouselImageModule {}
