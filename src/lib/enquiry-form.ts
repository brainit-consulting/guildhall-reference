// The public enquiry form's full address, for the owner to put on their website. The base is the app's own address
// (env.authUrl), never the request's Host header, which a visitor controls.
export const ENQUIRY_PATH = "/enquire";

export function enquiryFormUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "") + ENQUIRY_PATH;
}
