import 'package:flutter/services.dart';

bool isPluginMissing(Object error) {
  if (error is MissingPluginException) return true;
  return error is PlatformException && error.code == 'MissingPluginException';
}
