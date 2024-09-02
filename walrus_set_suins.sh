SUINS_UTILS_PACKAGE=0x7954ae683314ec7e156acbf0c0fc964ce035fd7f456fe7576848226502cfde1b
SUINS_CORE_OBJECT=0x300369e8909b9a6464da265b9a5a9ab6fe2158a040e84e808628cde7a07ee5a3
MY_SUINS_REGISTRATION_OBJECT=0x17d5eb7eaffeefd6fd6c19174d2c3caca863db7f9c6b94f5921d22b0b4a5cb41 # adjust this to your own SuiNS object
MY_WALRUS_SITE_OBJECT=0x7eb7e25bdf4ac71e57f25c1fe52104c9c045b43ab22c8c00047d4029916f9028 # adjust this to your Walrus Site object
sui client call \
    --package $SUINS_UTILS_PACKAGE \
    --module direct_setup \
    --function set_target_address \
    --gas-budget 500000000 \
    --args $SUINS_CORE_OBJECT \
    --args $MY_SUINS_REGISTRATION_OBJECT \
    --args "[$MY_WALRUS_SITE_OBJECT]" \
    --args 0x6