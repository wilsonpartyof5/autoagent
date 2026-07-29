import Foundation

struct VehicleDetailResponse: Codable {
    let success: Bool
    let data: VehicleDetailData?
    let error: VehicleDetailAPIError?
}

/// The error payload returned by the API (code + message).
/// Named VehicleDetailAPIError to avoid collision with the Swift error enum in VehicleDetailService.
struct VehicleDetailAPIError: Codable {
    let code: String
    let message: String
}

struct VehicleDetailData: Codable {
    let id: String
    let vin: String?
    let year: Int
    let make: String
    let model: String
    let trim: String?
    let condition: String
    /// Use FlexibleInt so MarketCheck float values (e.g. 28999.0) decode correctly
    let price: FlexibleInt
    let msrp: FlexibleInt?
    let miles: FlexibleInt?
    let bodyType: String?
    let exteriorColor: String?
    let interiorColor: String?
    let drivetrain: String?
    let fuelType: String?
    let transmission: String?
    let engine: String?
    let cityMpg: Int?
    let highwayMpg: Int?
    let seatingCapacity: Int?
    let powertrainType: String?
    let sellerComments: String?
    let description: String?
    let features: [String]?
    let options: [VehicleOption]?
    let photoUrls: [String]?
    let videoUrl: String?
    let daysOnMarket: FlexibleInt?
    let location: VehicleDetailLocation
    let enrichedAt: String
    let partial: Bool

    var priceInt: Int { price.value }
    var msrpInt: Int? { msrp?.value }
    var milesInt: Int? { miles?.value }
    var daysOnMarketInt: Int? { daysOnMarket?.value }
}

/// Decodes JSON numbers that may arrive as either Int or Double (e.g. 28999 or 28999.0).
struct FlexibleInt: Codable {
    let value: Int
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let intVal = try? container.decode(Int.self) {
            value = intVal
        } else if let dblVal = try? container.decode(Double.self) {
            value = Int(dblVal)
        } else {
            throw DecodingError.typeMismatch(
                Int.self,
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Expected Int or Double")
            )
        }
    }
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }
}

struct VehicleOption: Codable, Identifiable {
  var id: String { code ?? name ?? UUID().uuidString }
  let name: String?
  let code: String?
  let description: String?
}

struct VehicleDetailLocation: Codable {
  let latitude: Double?
  let longitude: Double?
  let dealerName: String
  let dealerCity: String?
  let dealerState: String?
  let dealerPhone: String?
  let dealerWebsite: String?
  let dealerAddress: String?
  let dealerRating: Double?
  let dealerReviewCount: FlexibleInt?
  let dealerHours: [String: String]?
}
