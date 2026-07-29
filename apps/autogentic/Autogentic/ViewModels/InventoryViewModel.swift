import Foundation
import Combine

final class InventoryViewModel: ObservableObject {
  @Published var vehicles: [Vehicle] = []

  init() {}
}

