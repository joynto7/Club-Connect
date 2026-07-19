// sslcommerz-lts ships no types — minimal shape for what this app actually calls.
// https://github.com/sslcommerz/SSLCommerz-NodeJS
declare module "sslcommerz-lts" {
  interface SslInitData {
    total_amount: number;
    currency: string;
    tran_id: string;
    success_url: string;
    fail_url: string;
    cancel_url: string;
    ipn_url: string;
    shipping_method: string;
    product_name: string;
    product_category: string;
    product_profile: string;
    cus_name: string;
    cus_email: string;
    cus_add1: string;
    cus_city: string;
    cus_postcode: string;
    cus_country: string;
    cus_phone: string;
    ship_name: string;
    ship_add1: string;
    ship_city: string;
    ship_postcode: string;
    ship_country: string;
  }

  interface SslInitResponse {
    status: string;
    GatewayPageURL?: string;
    sessionkey?: string;
    failedreason?: string;
    [key: string]: unknown;
  }

  interface SslValidationResponse {
    status: string; // "VALID" | "VALIDATED" | "INVALID" | "FAILED" | ...
    tran_id?: string;
    val_id?: string;
    amount?: string;
    store_amount?: string;
    currency?: string;
    [key: string]: unknown;
  }

  export default class SSLCommerzPayment {
    constructor(store_id: string, store_passwd: string, is_live?: boolean);
    init(data: SslInitData): Promise<SslInitResponse>;
    validate(data: { val_id: string }): Promise<SslValidationResponse>;
  }
}
