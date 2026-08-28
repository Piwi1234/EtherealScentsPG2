import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../modules/auth/decorators/public.decorator";
import { CatalogBrowseService } from "./browse.service";

/** Catálogo público (storefront): solo lectura, sin autenticación. */
@Public()
@ApiTags("catalog")
@Controller("catalog")
export class CatalogBrowseController {
  constructor(private readonly browse: CatalogBrowseService) {}

  /**
   * Listado de productos con filtros dinámicos.
   * Filtros de atributo: `?attr[<attributeId>]=valor1,valor2` (OR entre valores del mismo
   * atributo, AND entre atributos distintos). Para 'select' el valor es el id de la opción.
   */
  @Get("products")
  findProducts(
    @Query("categoryId") categoryId?: string,
    @Query("brandId") brandId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
    @Query("productCode") productCode?: string,
    @Query("attr") attr?: Record<string, string>,
    @Query("onlyDiscounted") onlyDiscounted?: string,
    @Query("onlyFlash") onlyFlash?: string,
    @Query("sortBy") sortBy?: string,
  ) {
    return this.browse.findProducts({
      categoryId,
      brandId,
      page,
      pageSize,
      search,
      productCode,
      attr,
      onlyDiscounted,
      onlyFlash,
      sortBy,
    });
  }

  @Get("categories/:categoryId/filters")
  getFilters(@Param("categoryId", ParseUUIDPipe) categoryId: string) {
    return this.browse.getFiltersForCategory(categoryId);
  }

  @Get("products/:id")
  getProduct(@Param("id", ParseUUIDPipe) id: string) {
    return this.browse.getProduct(id);
  }

  // No colisiona con ":id" (un solo segmento) — usado por /producto/[slug] público.
  @Get("products/slug/:slug")
  getProductBySlug(@Param("slug") slug: string) {
    return this.browse.getProductBySlug(slug);
  }
}
