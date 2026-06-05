import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Cada assinatura chega como uma imagem PNG em data URL
 * (ex.: "data:image/png;base64,iVBORw0...") gerada pelo canvas do frontend.
 * `null` limpa a assinatura existente.
 */
export class SaveSignaturesDto {
  @IsOptional()
  @IsString()
  @Matches(/^data:image\/png;base64,/, {
    message: 'Assinatura do responsável deve ser uma imagem PNG válida',
  })
  signatureTechnician?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^data:image\/png;base64,/, {
    message: 'Assinatura do cliente deve ser uma imagem PNG válida',
  })
  signatureCustomer?: string | null;
}
