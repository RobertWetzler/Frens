using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cliq.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddTerritoryCityCountry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "City",
                schema: "public",
                table: "TerritoryClaims",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Country",
                schema: "public",
                table: "TerritoryClaims",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TerritoryClaims_City",
                schema: "public",
                table: "TerritoryClaims",
                column: "City");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TerritoryClaims_City",
                schema: "public",
                table: "TerritoryClaims");

            migrationBuilder.DropColumn(
                name: "City",
                schema: "public",
                table: "TerritoryClaims");

            migrationBuilder.DropColumn(
                name: "Country",
                schema: "public",
                table: "TerritoryClaims");
        }
    }
}
