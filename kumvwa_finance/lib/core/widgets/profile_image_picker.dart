import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';

class ProfileImagePicker extends ConsumerStatefulWidget {
  const ProfileImagePicker({
    required this.name,
    required this.uploadBasePath,
    this.imageUrl,
    this.size = 72,
    super.key,
  });

  final String name;
  final String uploadBasePath;
  final String? imageUrl;
  final double size;

  @override
  ConsumerState<ProfileImagePicker> createState() => _ProfileImagePickerState();
}

class _ProfileImagePickerState extends ConsumerState<ProfileImagePicker> {
  String? _imageUrl;
  var _busy = false;

  @override
  void initState() {
    super.initState();
    _imageUrl = widget.imageUrl;
  }

  Future<void> _pick() async {
    final file = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png'],
    );
    if (file == null || _busy) return;
    final bytes = await file.readAsBytes();
    final mime = file.extension?.toLowerCase() == 'png'
        ? 'image/png'
        : 'image/jpeg';
    setState(() => _busy = true);
    try {
      final api = ref.read(apiClientProvider);
      final created = await api.postA(
        '${widget.uploadBasePath}/upload-url',
        data: {'kind': 'profile_image', 'mime': mime, 'size': bytes.length},
      );
      final data = Map<String, dynamic>.from(created.data as Map);
      final id = data['fileId'] as String;
      await Dio().put<void>(
        data['uploadUrl'] as String,
        data: bytes,
        options: Options(headers: {'Content-Type': mime}),
      );
      await api.postA('${widget.uploadBasePath}/$id/confirm');
      final linked = await api.postA('${widget.uploadBasePath}/profile-image/$id');
      if (mounted) {
        setState(() {
          _imageUrl =
              (linked.data as Map<String, dynamic>)['profileImageUrl'] as String?;
          _busy = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final initial = widget.name.trim().isEmpty
        ? 'U'
        : widget.name.trim()[0].toUpperCase();
    return InkWell(
      onTap: _busy ? null : _pick,
      borderRadius: BorderRadius.circular(widget.size / 2),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: widget.size,
            height: widget.size,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.blue600,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
            ),
            child: _imageUrl == null
                ? Text(
                    initial,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                    ),
                  )
                : ClipOval(
                    child: Image.network(
                      _imageUrl!,
                      width: widget.size,
                      height: widget.size,
                      fit: BoxFit.cover,
                    ),
                  ),
          ),
          Positioned(
            right: -2,
            bottom: -2,
            child: Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.card,
                shape: BoxShape.circle,
              ),
              child: _busy
                  ? const SizedBox(
                      width: 13,
                      height: 13,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(
                      Icons.edit_rounded,
                      size: 14,
                      color: AppColors.blue600,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
