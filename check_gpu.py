"""
GPU (CUDA) kullanılabilirliğini kontrol et.
Bu dosyayı çalıştırın: python check_gpu.py
"""

import sys

def check():
    try:
        import torch
        cuda_ok = torch.cuda.is_available()
        if cuda_ok:
            print(f"[OK] GPU kullanilabilir: {torch.cuda.get_device_name(0)}")
            print(f"     CUDA surumu: {torch.version.cuda}")
        else:
            print("[!] GPU bulunamadi veya PyTorch CPU surumu yuklu.")
            print("  main.py içinde USE_GPU = 'cpu' yapın.")
            print("\n  GPU kullanmak için PyTorch CUDA sürümü kurun:")
            print("  pip uninstall torch torchvision")
            print("  pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121")
        return cuda_ok
    except ImportError:
        print("[!] PyTorch yuklu degil.")
        return False

if __name__ == "__main__":
    check()
    sys.exit(0)
