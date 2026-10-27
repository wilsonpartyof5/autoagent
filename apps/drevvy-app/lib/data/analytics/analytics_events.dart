/// Snake-case product events. `object_action`, past tense when the action finished.
///
/// Every value is documented in `ANALYTICS.md`.
abstract final class AnalyticsEvents {
  static const appInstall = 'app_install';
  static const firstOpen = 'first_open';
  static const sessionStarted = 'session_started';
  static const sessionEnded = 'session_ended';

  static const screenViewed = 'screen_viewed';
  static const tabSelected = 'tab_selected';
  static const onboardingStepViewed = 'onboarding_step_viewed';
  static const onboardingSkipped = 'onboarding_skipped';
  static const onboardingPreferencesSaved = 'onboarding_preferences_saved';
  static const onboardingCompleted = 'onboarding_completed';

  static const locationPermissionAsked = 'location_permission_asked';
  static const locationPermissionGranted = 'location_permission_granted';
  static const locationPermissionDenied = 'location_permission_denied';
  static const locationZipStarted = 'location_zip_started';

  static const signInStarted = 'sign_in_started';
  static const signInCompleted = 'sign_in_completed';
  static const signInCancelled = 'sign_in_cancelled';
  static const signInFailed = 'sign_in_failed';
  static const signOut = 'sign_out';
  static const accountDeleteStarted = 'account_delete_started';
  static const accountDeleteConfirmed = 'account_delete_confirmed';
  static const accountDeleteCancelled = 'account_delete_cancelled';

  static const searchSubmitted = 'search_submitted';
  static const searchRefined = 'search_refined';
  static const modeSwitched = 'mode_switched';
  static const chatStarted = 'chat_started';
  static const chatOpened = 'chat_opened';
  static const chatDeleted = 'chat_deleted';
  static const chatRenamed = 'chat_renamed';
  static const historyOpened = 'history_opened';
  static const historyFiltered = 'history_filtered';
  static const historyRan = 'history_ran';
  static const historyDeleted = 'history_deleted';
  static const historyCleared = 'history_cleared';
  static const historyRestored = 'history_restored';

  static const memoryOpened = 'memory_opened';
  static const memoryEditStarted = 'memory_edit_started';
  static const memorySaved = 'memory_saved';
  static const memoryDeleted = 'memory_deleted';
  static const memoryDeleteUndone = 'memory_delete_undone';
  static const memoryAdded = 'memory_added';
  static const personalizeToggled = 'personalize_toggled';

  static const carViewed = 'car_viewed';
  static const carSaved = 'car_saved';
  static const carUnsaved = 'car_unsaved';
  static const findSimilarTapped = 'find_similar_tapped';

  static const dealAdded = 'deal_added';
  static const dealAddBlocked = 'deal_add_blocked';
  static const dealRemoved = 'deal_removed';
  static const dealRemoveKept = 'deal_remove_kept';
  static const dealStateViewed = 'deal_state_viewed';
  static const priceDropRoundViewed = 'price_drop_round_viewed';
  static const offerViewed = 'offer_viewed';
  static const offerAcceptStarted = 'offer_accept_started';
  static const offerAcceptConfirmed = 'offer_accept_confirmed';
  static const offerAcceptCancelled = 'offer_accept_cancelled';
  static const dealAccepted = 'deal_accepted';
  static const dealKeepGoing = 'deal_keep_going';
  static const outcomeSubmitted = 'outcome_submitted';
  static const dealBannerDismissed = 'deal_banner_dismissed';
  static const addToDrevvyConfirmed = 'add_to_drevvy_confirmed';
  static const rooftopMatchResolved = 'rooftop_match_resolved';
  static const marketIntelUnlocked = 'market_intel_unlocked';
  static const dealerConversationStarted = 'dealer_conversation_started';
  static const dealBrainChipTapped = 'deal_brain_chip_tapped';
  static const otdNumberRequested = 'otd_number_requested';

  static const paywallViewed = 'paywall_viewed';
  static const paywallDismissed = 'paywall_dismissed';
  static const packViewed = 'pack_viewed';
  static const packSelected = 'pack_selected';
  static const purchaseCompleted = 'purchase_completed';
  static const purchaseFailed = 'purchase_failed';
  static const purchasesRestoreStarted = 'purchases_restore_started';
  static const purchasesRestored = 'purchases_restored';
  static const packBalanceChanged = 'pack_balance_changed';

  static const notificationPermissionAsked = 'notification_permission_asked';
  static const notificationPermissionGranted = 'notification_permission_granted';
  static const notificationPermissionDenied = 'notification_permission_denied';
  static const notificationOsResult = 'notification_os_result';
  static const pushOpened = 'push_opened';

  static const settingsRowTapped = 'settings_row_tapped';
  static const analyticsToggled = 'analytics_toggled';
  static const privacyViewed = 'privacy_viewed';
  static const contactTapped = 'contact_tapped';
  static const directionsTapped = 'directions_tapped';

  static const emptyStateViewed = 'empty_state_viewed';
  static const errorShown = 'error_shown';
  static const errorRetry = 'error_retry';
  static const apiFailed = 'api_failed';
  static const offlineBannerRetried = 'offline_banner_retried';

  static const tradeInAnswered = 'trade_in_answered';
  static const leftDealershipAnswered = 'left_dealership_answered';
  static const changedOfferAction = 'changed_offer_action';
  static const acceptanceWithdrawConfirmed = 'acceptance_withdraw_confirmed';
  static const acceptanceWithdrawCancelled = 'acceptance_withdraw_cancelled';
  static const doneAction = 'done_action';

  static const all = <String>[
    appInstall,
    firstOpen,
    sessionStarted,
    sessionEnded,
    screenViewed,
    tabSelected,
    onboardingStepViewed,
    onboardingSkipped,
    onboardingPreferencesSaved,
    onboardingCompleted,
    locationPermissionAsked,
    locationPermissionGranted,
    locationPermissionDenied,
    locationZipStarted,
    signInStarted,
    signInCompleted,
    signInCancelled,
    signInFailed,
    signOut,
    accountDeleteStarted,
    accountDeleteConfirmed,
    accountDeleteCancelled,
    searchSubmitted,
    searchRefined,
    modeSwitched,
    chatStarted,
    chatOpened,
    chatDeleted,
    chatRenamed,
    historyOpened,
    historyFiltered,
    historyRan,
    historyDeleted,
    historyCleared,
    historyRestored,
    memoryOpened,
    memoryEditStarted,
    memorySaved,
    memoryDeleted,
    memoryDeleteUndone,
    memoryAdded,
    personalizeToggled,
    carViewed,
    carSaved,
    carUnsaved,
    findSimilarTapped,
    dealAdded,
    dealAddBlocked,
    dealRemoved,
    dealRemoveKept,
    dealStateViewed,
    priceDropRoundViewed,
    offerViewed,
    offerAcceptStarted,
    offerAcceptConfirmed,
    offerAcceptCancelled,
    dealAccepted,
    dealKeepGoing,
    outcomeSubmitted,
    dealBannerDismissed,
    addToDrevvyConfirmed,
    rooftopMatchResolved,
    marketIntelUnlocked,
    dealerConversationStarted,
    dealBrainChipTapped,
    otdNumberRequested,
    paywallViewed,
    paywallDismissed,
    packViewed,
    packSelected,
    purchaseCompleted,
    purchaseFailed,
    purchasesRestoreStarted,
    purchasesRestored,
    packBalanceChanged,
    notificationPermissionAsked,
    notificationPermissionGranted,
    notificationPermissionDenied,
    notificationOsResult,
    pushOpened,
    settingsRowTapped,
    analyticsToggled,
    privacyViewed,
    contactTapped,
    directionsTapped,
    emptyStateViewed,
    errorShown,
    errorRetry,
    apiFailed,
    offlineBannerRetried,
    tradeInAnswered,
    leftDealershipAnswered,
    changedOfferAction,
    acceptanceWithdrawConfirmed,
    acceptanceWithdrawCancelled,
    doneAction,
  ];
}
