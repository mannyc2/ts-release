const wave = process.argv[2]
if (wave !== "W08" && wave !== "W10") throw new Error("Unknown prerequisite owner")
throw new Error(`${wave === "W08" ? "Effect-build native integration" : "Packed production Action"} acceptance remains unimplemented; owned by ${wave}`)
