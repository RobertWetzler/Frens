using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cliq.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddPoisonPowerupMechanics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PoisonPenaltyUntilUtc",
                schema: "public",
                table: "TerritoryPlayers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TerritoryCellPoisons",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CellRow = table.Column<long>(type: "bigint", nullable: false),
                    CellCol = table.Column<long>(type: "bigint", nullable: false),
                    PoisonedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PoisonedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TriggeredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TriggeredByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TerritoryCellPoisons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TerritoryCellPoisons_AspNetUsers_PoisonedByUserId",
                        column: x => x.PoisonedByUserId,
                        principalSchema: "public",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TerritoryCellPoisons_AspNetUsers_TriggeredByUserId",
                        column: x => x.TriggeredByUserId,
                        principalSchema: "public",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TerritoryCellPoisons_CellRow_CellCol",
                schema: "public",
                table: "TerritoryCellPoisons",
                columns: new[] { "CellRow", "CellCol" });

            migrationBuilder.CreateIndex(
                name: "IX_TerritoryCellPoisons_ExpiresAtUtc",
                schema: "public",
                table: "TerritoryCellPoisons",
                column: "ExpiresAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_TerritoryCellPoisons_PoisonedByUserId",
                schema: "public",
                table: "TerritoryCellPoisons",
                column: "PoisonedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TerritoryCellPoisons_TriggeredAtUtc",
                schema: "public",
                table: "TerritoryCellPoisons",
                column: "TriggeredAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_TerritoryCellPoisons_TriggeredByUserId",
                schema: "public",
                table: "TerritoryCellPoisons",
                column: "TriggeredByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TerritoryCellPoisons",
                schema: "public");

            migrationBuilder.DropColumn(
                name: "PoisonPenaltyUntilUtc",
                schema: "public",
                table: "TerritoryPlayers");
        }
    }
}
