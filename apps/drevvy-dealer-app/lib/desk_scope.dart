import 'package:flutter/widgets.dart';

import 'data/demo_desk.dart';

class DeskScope extends InheritedNotifier<DealerDesk> {
  const DeskScope({super.key, required DealerDesk desk, required super.child})
      : super(notifier: desk);

  static DealerDesk of(BuildContext context) {
    final desk = context.dependOnInheritedWidgetOfExactType<DeskScope>()?.notifier;
    if (desk == null) {
      throw StateError('DeskScope missing');
    }
    return desk;
  }
}
