import Combine
import UIKit
import UserNotifications

@MainActor
final class NotificationRouter: ObservableObject {
    @Published var pendingLeadID: String?
    @Published var deviceToken: String?
}

final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()

    @MainActor let router = NotificationRouter()

    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    @MainActor
    func requestAuthorization() async {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(
                options: [.alert, .badge, .sound]
            )
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            // The app still works without push permission.
        }
    }

    @MainActor
    func received(deviceToken: Data) {
        router.deviceToken = deviceToken.map { String(format: "%02x", $0) }.joined()
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let leadID = response.notification.request.content.userInfo["lead_id"] as? String
        await MainActor.run {
            router.pendingLeadID = leadID
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            NotificationManager.shared.received(deviceToken: deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        #if DEBUG
        print("[Push] Registration failed: \(error.localizedDescription)")
        #endif
    }
}
