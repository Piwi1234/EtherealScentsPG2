import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { ProductService } from "./product.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateProductVariantDto, UpdateProductVariantDto } from "./dto/product-variant.dto";
import { CreateVariantOptionValueDto, UpdateVariantOptionValueDto } from "./dto/product-variant-option-value.dto";
import { productImageMulterOptions } from "./product-image.multer";
import { productVariantImageMulterOptions } from "./product-variant-image.multer";

@ApiTags("products")
@Controller("products")
export class ProductController {
  constructor(private readonly products: ProductService) {}

  @Get()
  findAll(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("categoryId") categoryId?: string,
    @Query("brandId") brandId?: string,
    @Query("search") search?: string,
  ) {
    return this.products.findAll({ page, pageSize, categoryId, brandId, search });
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.products.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Post(":id/image")
  @UseInterceptors(FileInterceptor("file", productImageMulterOptions))
  uploadImage(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    // Con diskStorage no hay file.buffer para que Nest valide el tipo por contenido;
    // el filtro de tipo ya corrió en multer (product-image.multer.ts) antes de guardar en disco.
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.products.setImage(id, file);
  }

  @Post(":id/variants")
  createVariant(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateProductVariantDto) {
    return this.products.createVariant(id, dto);
  }

  @Patch(":id/variants/:variantId")
  updateVariant(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.products.updateVariant(id, variantId, dto);
  }

  @Delete(":id/variants/:variantId")
  removeVariant(@Param("id", ParseUUIDPipe) id: string, @Param("variantId", ParseUUIDPipe) variantId: string) {
    return this.products.removeVariant(id, variantId);
  }

  @Post(":id/variants/:variantId/image")
  @UseInterceptors(FileInterceptor("file", productVariantImageMulterOptions))
  uploadVariantImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.products.setVariantImage(id, variantId, file);
  }

  @Post(":id/variant-options")
  addVariantOptionValue(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateVariantOptionValueDto) {
    return this.products.addVariantOptionValue(id, dto);
  }

  @Patch(":id/variant-options/:optionValueId")
  updateVariantOptionValue(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("optionValueId", ParseUUIDPipe) optionValueId: string,
    @Body() dto: UpdateVariantOptionValueDto,
  ) {
    return this.products.updateVariantOptionValue(id, optionValueId, dto);
  }

  @Delete(":id/variant-options/:optionValueId")
  removeVariantOptionValue(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("optionValueId", ParseUUIDPipe) optionValueId: string,
  ) {
    return this.products.removeVariantOptionValue(id, optionValueId);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.products.remove(id);
  }
}
