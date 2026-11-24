import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

const couldNotOpenPageMessage = "Couldn't open the page";

/// Opens a Drevvy web page in the device browser.
///
/// A failed launch shows a short note. Shopper copy stays plain.
Future<void> openDrevvyPage(BuildContext context, String url) async {
  var opened = false;
  try {
    opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
  } catch (_) {
    opened = false;
  }
  if (!opened && context.mounted) {
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text(couldNotOpenPageMessage)));
  }
}
