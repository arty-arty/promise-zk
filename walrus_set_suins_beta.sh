SUINS_UTILS_PACKAGE=0x7954ae683314ec7e156acbf0c0fc964ce035fd7f456fe7576848226502cfde1b
SUINS_CORE_OBJECT=0x300369e8909b9a6464da265b9a5a9ab6fe2158a040e84e808628cde7a07ee5a3
MY_SUINS_REGISTRATION_OBJECT=0xf1b50daa97e5a4fb7768e441e24439f58a1640b9c5fbf796125d38382339c6f3 # adjust this to your own SuiNS object
MY_WALRUS_SITE_OBJECT=0x012e58e82b0f2a73fa9a07e4e1243af8ccc2ea5d255260f9532769d6640b9858 # adjust this to your Walrus Site object
sui client call \
    --package $SUINS_UTILS_PACKAGE \
    --module direct_setup \
    --function set_target_address \
    --gas-budget 500000000 \
    --args $SUINS_CORE_OBJECT \
    --args $MY_SUINS_REGISTRATION_OBJECT \
    --args "[$MY_WALRUS_SITE_OBJECT]" \
    --args 0x6