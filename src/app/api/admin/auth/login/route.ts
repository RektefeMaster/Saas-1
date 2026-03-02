import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Bu giriş ucu devre dışı. Admin erişimi için dashboard kullanıcı adı girişini kullanın.",
    },
    { status: 410 }
  );
}
