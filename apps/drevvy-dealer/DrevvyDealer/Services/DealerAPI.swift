import Foundation

protocol DealerAPI: Sendable {
    func dealerships() async throws -> [Dealership]
    func dashboard(dealershipID: String) async throws -> DashboardSnapshot
    func leads(dealershipID: String) async throws -> [DealerLead]
    func inventory(dealershipID: String) async throws -> [InventoryVehicle]
    func updateLead(_ leadID: String, status: LeadStatus) async throws
    func resendLead(_ leadID: String) async throws
    func registerDeviceToken(_ token: String) async throws
}

enum DealerAPIError: LocalizedError {
    case invalidConfiguration
    case invalidResponse
    case server(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration:
            "The dealer service has not been configured yet."
        case .invalidResponse:
            "Drevvy sent an answer the app could not read."
        case .server(let statusCode):
            "Drevvy could not finish the request (error \(statusCode))."
        }
    }
}

actor LiveDealerAPI: DealerAPI {
    private let baseURL: URL
    private let session: URLSession
    private let accessToken: @Sendable () async -> String?
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(
        baseURL: URL,
        session: URLSession = .shared,
        accessToken: @escaping @Sendable () async -> String?
    ) {
        self.baseURL = baseURL
        self.session = session
        self.accessToken = accessToken
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
    }

    func dealerships() async throws -> [Dealership] {
        try await request(path: "bootstrap", response: BootstrapResponse.self).dealerships
    }

    func dashboard(dealershipID: String) async throws -> DashboardSnapshot {
        try await request(path: "dealerships/\(dealershipID)/overview", response: DashboardSnapshot.self)
    }

    func leads(dealershipID: String) async throws -> [DealerLead] {
        try await request(path: "dealerships/\(dealershipID)/leads", response: ListResponse<DealerLead>.self).items
    }

    func inventory(dealershipID: String) async throws -> [InventoryVehicle] {
        try await request(path: "dealerships/\(dealershipID)/inventory", response: ListResponse<InventoryVehicle>.self).items
    }

    func updateLead(_ leadID: String, status: LeadStatus) async throws {
        let body = try encoder.encode(StatusRequest(status: status))
        let _: EmptyResponse = try await request(
            path: "leads/\(leadID)/status",
            method: "PATCH",
            body: body,
            response: EmptyResponse.self
        )
    }

    func resendLead(_ leadID: String) async throws {
        let _: EmptyResponse = try await request(
            path: "leads/\(leadID)/resend",
            method: "POST",
            response: EmptyResponse.self
        )
    }

    func registerDeviceToken(_ token: String) async throws {
        let body = try encoder.encode(DeviceTokenRequest(token: token, platform: "ios"))
        let _: EmptyResponse = try await request(
            path: "devices",
            method: "POST",
            body: body,
            response: EmptyResponse.self
        )
    }

    private func request<Response: Decodable>(
        path: String,
        method: String = "GET",
        body: Data? = nil,
        response: Response.Type
    ) async throws -> Response {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let token = await accessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, urlResponse) = try await session.data(for: request)
        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            throw DealerAPIError.invalidResponse
        }
        guard 200..<300 ~= httpResponse.statusCode else {
            throw DealerAPIError.server(statusCode: httpResponse.statusCode)
        }
        if Response.self == EmptyResponse.self, data.isEmpty {
            return EmptyResponse() as! Response
        }
        return try decoder.decode(Response.self, from: data)
    }
}

private struct BootstrapResponse: Decodable {
    let dealerships: [Dealership]
}

private struct ListResponse<Item: Decodable>: Decodable {
    let items: [Item]
}

private struct StatusRequest: Encodable {
    let status: LeadStatus
}

private struct DeviceTokenRequest: Encodable {
    let token: String
    let platform: String
}

private struct EmptyResponse: Codable {}
